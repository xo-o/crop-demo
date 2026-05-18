import { type FabricImage, type TPointerEventInfo, Point, FabricObject, util } from 'fabric';
import { createImageCroppingControls } from './croppingControls';
import { cropPanMoveHandler, renderGhostImage } from './croppingHandlers';

interface CroppingFabricImage extends FabricImage {
  __isCropping?: boolean;
}

/**
 * Coordinates the change to image to enter crop mode and handles the full lifecycle.
 */
export const enterCropMode = (fabricImage: FabricImage) => {
  const img = fabricImage as CroppingFabricImage;
  if (img.__isCropping) return;

  const canvas = img.canvas;
  if (!canvas) return;

  img.__isCropping = true;

  // Store original state to restore later
  const originalControls = img.controls;
  const originalPadding = img.padding;
  const originalHasBorders = img.hasBorders;
  // @ts-expect-error - overriding prototype method
  const originalContainsPoint = img.containsPoint;
  
  const originalSelection = canvas.selection;
  const otherObjects = canvas.getObjects().filter(obj => obj !== img);
  const originalObjectsState = new Map<FabricObject, { selectable: boolean; evented: boolean }>();

  otherObjects.forEach(obj => {
    originalObjectsState.set(obj, {
      selectable: obj.selectable,
      evented: obj.evented,
    });
    obj.selectable = false;
    obj.evented = false;
  });

  canvas.selection = false;

  // Set crop mode state
  img.padding = 0;
  img.controls = createImageCroppingControls();
  img.hasBorders = false; // We use custom borders in renderGhostImage

  // Hit area expansion for ghost image
  img.containsPoint = function (point: Point) {
    const center = this.getCenterPoint();
    const unrotatedPoint = point.rotate(-util.degreesToRadians(this.getTotalAngle()), center);

    let dx = unrotatedPoint.x - center.x;
    let dy = unrotatedPoint.y - center.y;

    dx /= Math.abs(this.scaleX);
    dy /= Math.abs(this.scaleY);

    if (this.flipX) dx = -dx;
    if (this.flipY) dy = -dy;

    const element = this.getElement();
    const ghostX = -this.width / 2 - this.cropX;
    const ghostY = -this.height / 2 - this.cropY;

    return (
      dx >= ghostX &&
      dx <= ghostX + element.width &&
      dy >= ghostY &&
      dy <= ghostY + element.height
    );
  };

  // Events
  img.on('moving', cropPanMoveHandler);
  img.on('before:render', renderGhostImage);

  const exitCropMode = () => {
    img.__isCropping = false;
    img.padding = originalPadding;
    img.controls = originalControls;
    img.hasBorders = originalHasBorders;
    img.containsPoint = originalContainsPoint;

    img.off('moving', cropPanMoveHandler);
    img.off('before:render', renderGhostImage);
    img.off('mousedblclick', exitCropMode);

    // Restore canvas and other objects
    canvas.selection = originalSelection;
    otherObjects.forEach(obj => {
      const state = originalObjectsState.get(obj);
      if (state) {
        obj.selectable = state.selectable;
        obj.evented = state.evented;
      }
    });

    // Cleanup listeners
    canvas.off('mouse:down', onCanvasMouseDown);
    window.removeEventListener('keydown', onKeyDown);

    img.setCoords();
    canvas.requestRenderAll();
  };

  const onCanvasMouseDown = (e: TPointerEventInfo) => {
    // If e.target is the image itself, we definitely want to stay in crop mode.
    if (e.target === img) return;

    // e.target might be null if we clicked outside the *visible* crop area,
    // but we need to check if we clicked inside the ghost area (the full element bounds).
    // The image's containsPoint method (which we overrode) handles this check.
    const pointer = canvas.getScenePoint(e.e);
    // @ts-expect-error - Point constructor type mismatch in fabric v6/v7
    const isInsideGhost = img.containsPoint(new Point(pointer.x, pointer.y));

    if (!isInsideGhost) {
      exitCropMode();
    } else {
      // If we clicked inside the ghost area but outside the main crop area,
      // Fabric might have cleared the active object. We need to restore it.
      canvas.setActiveObject(img);

      // Prevent native browser dragging or selection
      if (e.e.preventDefault) e.e.preventDefault();

      // Setup manual dragging for the ghost area using global window events
      // to ensure we track movement even if the cursor leaves the canvas.
      // @ts-expect-error - Point constructor type mismatch in fabric v6/v7
      let lastPointer = new Point(pointer.x, pointer.y);

      const onGhostMouseMove = (moveEvent: MouseEvent | TouchEvent) => {
        const currentPointer = canvas.getScenePoint(moveEvent);
        
        const dx = currentPointer.x - lastPointer.x;
        const dy = currentPointer.y - lastPointer.y;

        if (dx === 0 && dy === 0) return;

        // Account for image rotation and scale
        // @ts-expect-error - Point constructor type mismatch in fabric v6/v7
        const p = new Point(dx, dy).transform(
          util.invertTransform(
            util.createRotateMatrix({ angle: img.getTotalAngle() })
          )
        );

        let newCropX = img.cropX - (p.x / img.scaleX) * (img.flipX ? -1 : 1);
        let newCropY = img.cropY - (p.y / img.scaleY) * (img.flipY ? -1 : 1);

        const { width, height, _element } = img;
        if (newCropX < 0) newCropX = 0;
        if (newCropY < 0) newCropY = 0;
        if (newCropX + width > _element.width) newCropX = _element.width - width;
        if (newCropY + height > _element.height) newCropY = _element.height - height;

        img.cropX = newCropX;
        img.cropY = newCropY;

        img.setCoords();

        // @ts-expect-error - Point constructor type mismatch in fabric v6/v7
        lastPointer = new Point(currentPointer.x, currentPointer.y);
        canvas.requestRenderAll();
      };

      const onGhostMouseUp = () => {
        window.removeEventListener('mousemove', onGhostMouseMove);
        window.removeEventListener('touchmove', onGhostMouseMove);
        window.removeEventListener('mouseup', onGhostMouseUp);
        window.removeEventListener('touchend', onGhostMouseUp);
      };

      window.addEventListener('mousemove', onGhostMouseMove, { passive: false });
      window.addEventListener('touchmove', onGhostMouseMove, { passive: false });
      window.addEventListener('mouseup', onGhostMouseUp);
      window.addEventListener('touchend', onGhostMouseUp);
    }
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' || e.key === 'Enter') {
      exitCropMode();
    }
  };

  // Attach exit listeners
  img.on('mousedblclick', exitCropMode);
  
  // We use a small timeout to avoid immediate exit if this was triggered by a click
  setTimeout(() => {
    canvas.on('mouse:down', onCanvasMouseDown);
    window.addEventListener('keydown', onKeyDown);
  }, 100);

  img.setCoords();
  canvas.requestRenderAll();
  
  return exitCropMode;
};