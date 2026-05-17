import { useEffect, useRef } from "react";
import { Canvas, FabricImage, Control, Point, util } from "fabric";
import {
  createImageCroppingControls,
  cropPanMoveHandler,
  renderGhostImage,
  enterCropMode as baseEnterCropMode,
} from "./cropping_controls"; // your cropping handlers

function App() {
  const canvasRef = useRef<Canvas | null>(null);

  useEffect(() => {
    canvasRef.current = new Canvas("canvas", {
      width: 900,
      height: 600,
      backgroundColor: "#f3f3f3",
    });

    return () => {
      canvasRef.current?.dispose();
    };
  }, []);

  const addImageByUrl = async () => {
    const url =
      "https://i.ibb.co/jvBtgMVK/uriel-soberanes-xadzc-CQZ-Xc-unsplash.jpg";

    const img = await FabricImage.fromURL(url, { crossOrigin: "anonymous" });

    img.set({
      left: 100,
      top: 100,
      scaleX: 0.5,
      scaleY: 0.5,
      selectable: true,
    });

    canvasRef.current?.add(img);
    canvasRef.current?.centerObject(img);
    canvasRef.current?.setActiveObject(img);
    canvasRef.current?.renderAll();

    // Add Canva-style crop
    img.__isCropping = false;
    img.__originalControls = img.controls;
    img.__originalPadding = img.padding;

    // persistent dblclick listener
    img.on("mousedblclick", () => {
      if (!img.__isCropping) {
        enterCropMode(img);
      } else {
        exitCropMode(img);
      }
    });
  };

  const enterCropMode = (fabricImage: FabricImage & any) => {
    fabricImage.__isCropping = true;

    fabricImage.__originalControls = fabricImage.controls;
    fabricImage.__originalPadding = fabricImage.padding;

    fabricImage.padding = 0;
    fabricImage.controls = createImageCroppingControls();

    // image panning inside crop rectangle
    fabricImage.on("moving", cropPanMoveHandler);
    // render ghost overlay
    fabricImage.on("before:render", renderGhostImage);

    fabricImage.setCoords();
    fabricImage.canvas?.requestRenderAll();
  };

  const exitCropMode = (fabricImage: FabricImage & any) => {
    fabricImage.__isCropping = false;

    fabricImage.padding = fabricImage.__originalPadding;
    fabricImage.controls = fabricImage.__originalControls;

    fabricImage.off("moving", cropPanMoveHandler);
    fabricImage.off("before:render", renderGhostImage);

    fabricImage.setCoords();
    fabricImage.canvas?.requestRenderAll();
  };

  return (
    <>
      <canvas id="canvas" />
      <button onClick={addImageByUrl} className="border p-2 mt-4">
        Add Image
      </button>
    </>
  );
}

export default App;