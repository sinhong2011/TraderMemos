import {
  Button,
  ColorPicker,
  Host,
  HStack,
  Image,
  LabeledContent,
  Picker,
  Section,
  Spacer,
  Text as UIText,
  TextField,
  useNativeState,
} from '@expo/ui/swift-ui';
import { font, foregroundStyle, scrollDismissesKeyboard, tag } from '@expo/ui/swift-ui/modifiers';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { Alert } from 'react-native';

import { queryKeys, useApiRequest, useTags } from '@/api/hooks';
import type { Tag } from '@/api/types';
import { CenteredButton } from '@/components/centered-button';
import { t } from '@lingui/core/macro';
import { SettingsForm } from '@/components/settings-form';

const DEFAULT_TAG_COLOR = '#6366f1';

const TAG_KINDS = [
  { value: 'custom', label: () => t`Custom` },
  { value: 'mistake', label: () => t`Mistake` },
];

function kindLabel(kind: string): string {
  return TAG_KINDS.find((option) => option.value === kind)?.label() ?? kind;
}

/**
 * Tag management (web JournalTab parity): create with name/kind/color,
 * tap a tag to delete it. Editing colors later happens on web; the API's
 * PUT /tags is not exposed here to keep the screen one-shot simple.
 */
export default function TagsScreen() {
  const queryClient = useQueryClient();
  const api = useApiRequest();
  const { data: tags, isLoading } = useTags();

  const nameState = useNativeState('');
  const nameText = useRef('');
  const [kind, setKind] = useState('custom');
  const [color, setColor] = useState(DEFAULT_TAG_COLOR);

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: queryKeys.tags() });

  const create = useMutation({
    mutationFn: (body: { name: string; color: string; kind: string }) =>
      api('/tags', { method: 'POST', body }),
    onSuccess: () => {
      invalidate();
      nameState.set('');
      nameText.current = '';
    },
    onError: (err) => Alert.alert(t`Could not create tag`, err.message),
  });

  const remove = useMutation({
    mutationFn: (tagId: string) => api(`/tags/${tagId}`, { method: 'DELETE' }),
    onSuccess: invalidate,
    onError: (err) => Alert.alert(t`Could not delete tag`, err.message),
  });

  function handleCreate() {
    const name = nameText.current.trim();
    if (!name) {
      Alert.alert(t`Could not create tag`, t`Tag name is required.`);
      return;
    }
    create.mutate({ name, color, kind });
  }

  function confirmDelete(target: Tag) {
    Alert.alert(t`Delete tag?`, t`Removes “${target.name}” from every trade it annotates.`, [
      { text: t`Cancel`, style: 'cancel' },
      { text: t`Delete`, style: 'destructive', onPress: () => remove.mutate(target.id) },
    ]);
  }

  return (
    <Host style={{ flex: 1 }}>
      <SettingsForm modifiers={[scrollDismissesKeyboard('immediately')]}>
        <Section
          title={t`New tag`}
          footer={<UIText>{t`Annotate trades with mistakes, habits, and custom labels.`}</UIText>}
        >
          <LabeledContent label={t`Name`}>
            <TextField
              placeholder={t`e.g. FOMO`}
              text={nameState}
              onTextChange={(text) => {
                nameText.current = text;
              }}
            />
          </LabeledContent>
          <Picker label={t`Kind`} selection={kind} onSelectionChange={setKind}>
            {TAG_KINDS.map((option) => (
              <UIText key={option.value} modifiers={[tag(option.value)]}>
                {option.label()}
              </UIText>
            ))}
          </Picker>
          <ColorPicker
            label={t`Color`}
            selection={color}
            onSelectionChange={setColor}
            supportsOpacity={false}
          />
          <CenteredButton
            label={create.isPending ? t`Creating…` : t`Create tag`}
            onPress={handleCreate}
          />
        </Section>

        <Section title={t`Tags`} footer={<UIText>{t`Tap a tag to delete it.`}</UIText>}>
          {(tags ?? []).map((item) => (
            <Button key={item.id} onPress={() => confirmDelete(item)}>
              <HStack spacing={8}>
                <Image systemName="circle.fill" size={10} color={item.color || DEFAULT_TAG_COLOR} />
                <UIText modifiers={[foregroundStyle({ type: 'hierarchical', style: 'primary' })]}>
                  {item.name}
                </UIText>
                <Spacer />
                <UIText
                  modifiers={[
                    font({ size: 13 }),
                    foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
                  ]}
                >
                  {kindLabel(item.kind)}
                </UIText>
              </HStack>
            </Button>
          ))}
          {(tags ?? []).length === 0 ? (
            <UIText modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
              {isLoading ? t`Loading…` : t`No tags yet`}
            </UIText>
          ) : null}
        </Section>
      </SettingsForm>
    </Host>
  );
}
