import React, { useEffect, useRef, useState } from 'react';
import './App.css';

// public下のアセットへアクセス
const assetsPath = '/assets';

const getUrl = (path: string) => {
  return new URL(path, import.meta.url).href;
};

const App: React.FC = () => {
  const [initState, setInitState] = useState(0);

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
    setInitState(1);

    init();

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

    console.log(getUrl(assetsPath + '/haruka/Haruka_home.skel'));
    assetManager.loadBinary(getUrl(assetsPath + '/haruka/Haruka_home.skel'));
    assetManager.loadTextureAtlas(
      getUrl(assetsPath + '/haruka/Haruka_home.atlas')
    );
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
    const atlas = assetManager.get(
      getUrl(assetsPath + '/haruka/Haruka_home.atlas')
    );
    const atlasLoader = new window.spine.AtlasAttachmentLoader(atlas);
    const skeletonBinary = new window.spine.SkeletonBinary(atlasLoader);

    skeletonBinary.scale = 1;
    const skeletonData = skeletonBinary.readSkeletonData(
      assetManager.get(getUrl(assetsPath + '/haruka/Haruka_home.skel'))
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

export default App;
