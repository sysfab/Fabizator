import {
  TransformWrapper,
  TransformComponent,
} from "react-zoom-pan-pinch";

export function ImagePreview({ file }) {
  return (
    <div className="image-preview-shell">
      <div className="image-preview-stage">
        <TransformWrapper
          minScale={0.5}
          maxScale={10}
          centerOnInit
          limitToBounds={true}
          wheel={{ step: 0.01 }}
          panning={{
            disabled: false,
          }}
          pinch={{
            disabled: false,
          }}
        >
          <TransformComponent
            wrapperStyle={{
              width: "100%",
              height: "100%",
            }}
          >
            <img
              src={file.previewDataUrl}
              alt={file.name}
              className="image-preview"
            />
          </TransformComponent>
        </TransformWrapper>
      </div>
    </div>
  );
}