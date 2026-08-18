import { Toast, toast, type ToastVariant } from 'panelui-native';

/**
 * The app's toast. `toast.show(config)` builds PanelUI's default surface,
 * which draws a variant-tinted border — an edge the app's borderless
 * direction doesn't want. `ToastOptions` takes no `className`, so the only
 * seam is the `component` override: the same anatomy, border stripped, the
 * `bg-popover` elevation and shadow doing the separating.
 */
export function showToast({
  variant = 'success',
  label,
}: {
  variant?: ToastVariant;
  label: string;
}) {
  toast.show({
    component: ({ hide }) => (
      <Toast variant={variant} onHide={hide} className="border-0">
        <Toast.Indicator />
        <Toast.Content>
          <Toast.Title>{label}</Toast.Title>
        </Toast.Content>
        <Toast.Close />
      </Toast>
    ),
  });
}
