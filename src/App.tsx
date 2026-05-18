import { useEffect, useRef } from "react";
import { Canvas, FabricImage } from "fabric";
import { enterCropMode } from "./cropping_controls";

function App() {
  const canvasRef = useRef<Canvas | null>(null);

  useEffect(() => {
    const canvas = new Canvas("canvas", {
      width: 900,
      height: 600,
      backgroundColor: "#f3f3f3",
    });
    canvasRef.current = canvas;

    return () => {
      canvas.dispose();
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

    const canvas = canvasRef.current;
    if (canvas) {
      canvas.add(img);
      canvas.centerObject(img);
      canvas.setActiveObject(img);
      canvas.renderAll();

      // persistent dblclick listener to enter crop mode
      img.on("mousedblclick", () => {
        enterCropMode(img);
      });
    }
  };

  return (
    <>
      <canvas id="canvas" />
      <button onClick={addImageByUrl} className="border p-2 mt-4 block">
        Add Image
      </button>
    </>
  );
}

export default App;