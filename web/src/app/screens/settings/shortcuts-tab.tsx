import { KeybindingRecorder } from "@/components/KeybindingRecorder";
import { Button } from "@/components/ui/button";
import { HOTKEY_GROUPS, hotkeyCommandName, useKeybindings } from "@/lib/keybindings";
import { SettingsGroup, SettingsGroupRow, SettingsSection } from "./settings-ui";

export function ShortcutsTab() {
  const overrides = useKeybindings((s) => s.overrides);
  const resetAll = useKeybindings((s) => s.resetAll);
  const customCount = Object.keys(overrides).length;

  return (
    <>
      {HOTKEY_GROUPS.map((group, groupIndex) => (
        <SettingsSection
          key={group.title}
          title={group.title}
          description={
            groupIndex === 0
              ? "Shortcuts are ignored while you're typing in a field or filling in a form."
              : undefined
          }
          action={
            groupIndex === 0 && customCount > 0 ? (
              <Button type="button" variant="outline" size="sm" onClick={resetAll}>
                Reset all
              </Button>
            ) : undefined
          }
        >
          <SettingsGroup>
            {group.ids.map((id, index) => (
              <SettingsGroupRow
                key={id}
                label={hotkeyCommandName(id)}
                last={index === group.ids.length - 1}
              >
                <div className="flex md:justify-end">
                  <KeybindingRecorder id={id} />
                </div>
              </SettingsGroupRow>
            ))}
          </SettingsGroup>
        </SettingsSection>
      ))}
    </>
  );
}
