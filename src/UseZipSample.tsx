import React, { useEffect, useRef } from 'react';
import './App.css';
import JSZip from 'jszip';

let initState = 0;
// public下のアセットへアクセス
const assetsPath = '/assets';

const urls = {
  atlas: '',
  skel: '',
  textures: [] as string[],
};

const getUrl = (path: string) => {
  return new URL(path, import.meta.url).href;
};

const getBlobId = (url: string) => {
  // URLオブジェクトを作成し、pathnameからID部分を取得
  const parsedUrl = new URL(url);
  const blobId = parsedUrl.pathname.split('/').pop();
  return blobId || '';
};

const UseZipSample: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  let gl: WebGLRenderingContext | null = null;
  let shader: spine.webgl.Shader;
  let batcher: spine.webgl.PolygonBatcher;
  const mvp = new window.spine.webgl.Matrix4();
  let assetManager: spine.webgl.AssetManager;
  let skeletonRenderer: spine.webgl.SkeletonRenderer;

  let lastFrameTime: number;
  let spineboy: {
    skeleton: spine.Skeleton;
    state: spine.AnimationState;
    bounds: {
      offset: spine.Vector2;
      size: spine.Vector2;
    };
    premultipliedAlpha: boolean;
  };

  useEffect(() => {
    if (initState > 0) return;
    initState = 1;

    (async () => {
      try {
        console.log('Fetching ZIP file...');
        const response = await fetch(getUrl(assetsPath + '/haruka.zip'));
        console.log('Response received:', response);

        if (!response.ok) {
          throw new Error(
            `Failed to fetch the ZIP file. Status: ${response.status}`
          );
        }

        const blob = await response.blob();
        console.log('Blob created:', blob);

        const zip = await JSZip.loadAsync(blob);
        console.log('ZIP file loaded:', zip);
        const atlasFileName = Object.keys(zip.files).find((fileName) =>
          fileName.endsWith('.atlas')
        );
        if (!atlasFileName) return;
        let atlasText = await zip.file(atlasFileName)?.async('text');
        if (!atlasText) return;

        for (const filename of Object.keys(zip.files)) {
          console.log('Processing file:', filename);
          const fileData = await zip.file(filename)?.async('blob');
          if (fileData) {
            const url = URL.createObjectURL(fileData);
            console.log('URL created for file:', filename, url);
            if (filename.endsWith('.skel')) {
              urls.skel = url;
            } else if (filename.endsWith('.png')) {
              atlasText = atlasText.replace(filename, getBlobId(url));
              urls.textures.push(url);
            }
          }
        }
        urls.atlas = URL.createObjectURL(
          new Blob([atlasText], { type: 'text/plain' })
        );
        console.log('All URLs:', urls);
      } catch (error) {
        console.error('Error fetching or extracting ZIP:', error);
        alert('Failed to load ZIP file. Please check the URL.');
      }

      init();
    })();

    window.addEventListener('resize', resize);

    return () => {
      window.removeEventListener('resize', resize);
    };
  }, []);

  const init = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const config = { alpha: false };
    gl =
      ((canvas.getContext('webgl', config) ||
        canvas.getContext(
          'experimental-webgl',
          config
        )) as WebGLRenderingContext) || null;
    if (!gl) {
      alert('WebGL is unavailable.');
      return;
    }

    shader = window.spine.webgl.Shader.newTwoColoredTextured(gl);
    batcher = new window.spine.webgl.PolygonBatcher(gl);
    mvp.ortho2d(0, 0, canvas.width - 1, canvas.height - 1);
    skeletonRenderer = new window.spine.webgl.SkeletonRenderer(
      gl as unknown as spine.webgl.ManagedWebGLRenderingContext
    );
    assetManager = new window.spine.webgl.AssetManager(gl);

    assetManager.loadBinary(urls.skel);
    assetManager.loadTextureAtlas(urls.atlas);
    URL.revokeObjectURL(urls.skel);
    URL.revokeObjectURL(urls.atlas);
    requestAnimationFrame(load);
  };

  const load = () => {
    if (assetManager.isLoadingComplete()) {
      spineboy = loadSpineboy('Idle_01', true);
      lastFrameTime = Date.now() / 1000;
      requestAnimationFrame(render);
    } else {
      requestAnimationFrame(load);
    }
  };

  const loadSpineboy = (
    initialAnimation: string,
    premultipliedAlpha: boolean
  ) => {
    const atlas = assetManager.get(urls.atlas);
    const atlasLoader = new window.spine.AtlasAttachmentLoader(atlas);
    urls.textures.forEach((texture) => URL.revokeObjectURL(texture));
    const skeletonBinary = new window.spine.SkeletonBinary(atlasLoader);

    skeletonBinary.scale = 1;
    const skeletonData = skeletonBinary.readSkeletonData(
      assetManager.get(urls.skel)
    );
    const skeleton = new window.spine.Skeleton(skeletonData);
    const bounds = calculateSetupPoseBounds(skeleton);

    const animationStateData = new window.spine.AnimationStateData(
      skeleton.data
    );
    const animationState = new window.spine.AnimationState(animationStateData);
    animationState.setAnimation(0, initialAnimation, true);

    return { skeleton, state: animationState, bounds, premultipliedAlpha };
  };

  const calculateSetupPoseBounds = (skeleton: spine.Skeleton) => {
    skeleton.setToSetupPose();
    skeleton.updateWorldTransform();
    const offset = new window.spine.Vector2();
    const size = new window.spine.Vector2();
    skeleton.getBounds(offset, size, []);
    return { offset, size };
  };

  const render = () => {
    const now = Date.now() / 1000;
    const delta = now - lastFrameTime;
    lastFrameTime = now;

    resize();

    gl!.clearColor(0.3, 0.3, 0.3, 1);
    gl!.clear(gl!.COLOR_BUFFER_BIT);

    const skeleton = spineboy.skeleton;
    const state = spineboy.state;
    const premultipliedAlpha = spineboy.premultipliedAlpha;
    state.update(delta);
    state.apply(skeleton);
    skeleton.updateWorldTransform();

    shader.bind();
    shader.setUniformi(window.spine.webgl.Shader.SAMPLER, 0);
    shader.setUniform4x4f(window.spine.webgl.Shader.MVP_MATRIX, mvp.values);

    batcher.begin(shader);
    skeletonRenderer.premultipliedAlpha = premultipliedAlpha;
    skeletonRenderer.draw(batcher, skeleton);
    batcher.end();

    shader.unbind();

    requestAnimationFrame(render);
  };

  const resize = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }

    const bounds = spineboy.bounds;
    const centerX = bounds.offset.x + bounds.size.x / 2;
    const centerY = bounds.offset.y + bounds.size.y / 2;
    const scaleX = bounds.size.x / canvas.width;
    const scaleY = bounds.size.y / canvas.height;
    let scale = Math.max(scaleX, scaleY) * 1.2;
    if (scale < 1) scale = 1;
    const width = canvas.width * scale;
    const height = canvas.height * scale;

    mvp.ortho2d(centerX - width / 2, centerY - height / 2, width, height);
    gl!.viewport(0, 0, canvas.width, canvas.height);
  };

  return <canvas ref={canvasRef} id="canvas"></canvas>;
};

export default UseZipSample;
