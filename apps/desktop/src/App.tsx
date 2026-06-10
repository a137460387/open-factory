import { EditorShell } from './components/EditorShell';
import { ToastViewport } from './components/common/Toast';
import { NativeCancelSmokeRunner } from './smoke/NativeCancelSmokeRunner';
import { NativePreviewSmokeRunner } from './smoke/NativePreviewSmokeRunner';

export function App() {
  return (
    <>
      <EditorShell />
      <ToastViewport />
      <NativePreviewSmokeRunner />
      <NativeCancelSmokeRunner />
    </>
  );
}
