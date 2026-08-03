import {
  Host,
  Section,
  Text as UIText,
  TextField,
  useNativeState,
} from '@expo/ui/swift-ui';
import { lineLimit, scrollDismissesKeyboard } from '@expo/ui/swift-ui/modifiers';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';

import { queryKeys, useApiRequest, useChecklistTemplate } from '@/api/hooks';
import { CenteredButton } from '@/components/centered-button';
import { t } from '@lingui/core/macro';
import { SettingsForm } from '@/components/settings-form';

/**
 * Daily checklist template editor (web "Daily Checklist" section). Plain-text
 * markdown here — the web rich-text editor round-trips the same `content`
 * string, and `- [ ]` lines become tasks on New Note.
 */
export default function ChecklistScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const api = useApiRequest();
  const checklist = useChecklistTemplate();

  const contentState = useNativeState('');
  const contentText = useRef('');

  const prefilled = useRef(false);
  useEffect(() => {
    if (checklist.data == null || prefilled.current) return;
    prefilled.current = true;
    const content = checklist.data.content ?? '';
    contentState.set(content);
    contentText.current = content;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checklist.data]);

  const save = useMutation({
    mutationFn: (content: string) =>
      api('/settings/checklist-template', { method: 'PUT', body: { content } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.checklistTemplate() });
      router.back();
    },
    onError: (err) => Alert.alert(t`Could not save checklist`, err.message),
  });

  return (
    <Host style={{ flex: 1 }}>
      <SettingsForm modifiers={[scrollDismissesKeyboard('interactively')]}>
        <Section
          title={t`Rules & checklist`}
          footer={
            <UIText>
              {t`Use "- [ ]" for each rule — those lines appear as task items when you create a daily log on New Note.`}
            </UIText>
          }
        >
          <TextField
            placeholder={'- [ ] Check VIX\n- [ ] No revenge trades\n- [ ] Size within risk rules'}
            text={contentState}
            axis="vertical"
            onTextChange={(text) => {
              contentText.current = text;
            }}
            modifiers={[lineLimit({ min: 8, max: 20 })]}
          />
        </Section>

        <Section>
          <CenteredButton
            label={save.isPending ? t`Saving…` : t`Save checklist`}
            onPress={() => save.mutate(contentText.current)}
          />
        </Section>
      </SettingsForm>
    </Host>
  );
}
