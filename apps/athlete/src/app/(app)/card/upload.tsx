import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { RESUME_UPLOAD_LIMITS, type ResumeUploadRequest } from '@team-impact/contracts';
import { colors, spacing } from '@team-impact/ui-tokens';
import { api } from '@/api';
import { Chip, ErrorText, Gutter, Screen, SectionLabel } from '@/components/ui';
import { Button, Card, Icon, Input, Text } from '@/ui';

type Kind = 'pdf' | 'photo';
const MIME: Record<Kind, ResumeUploadRequest['mimeType']> = {
  pdf: 'application/pdf',
  photo: 'image/jpeg',
};
const MB = 1024 * 1024;

/**
 * "/card/upload": hand over a resume (PDF or photo). On the mock API there is no file picker yet:
 * name the file and, to try the reader, paste the resume's text. A name containing "fail" shows
 * the type-it-yourself path.
 */
export default function UploadResume() {
  const [kind, setKind] = useState<Kind>('pdf');
  const [fileName, setFileName] = useState('resume.pdf');
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const upload = () => {
    setBusy(true);
    setError(null);
    api
      .uploadResume({
        fileName,
        mimeType: MIME[kind],
        sizeBytes: 200_000,
        ...(text.trim() ? { text } : {}),
      })
      .then(
        () => router.replace('/card/review'),
        (e: Error) => {
          setBusy(false);
          setError(e.message);
        },
      );
  };

  return (
    <Screen eyebrow="Baseball Card" title="Upload resume" back>
      <Gutter>
        <Card style={styles.note}>
          <Icon name="lock" size={18} color={colors.brand} />
          <Text variant="small" color="brand" style={styles.grow}>
            We read your resume and suggest card fields. Nothing shows on your card, or to anyone,
            until you check and confirm it. We don’t keep addresses or birthdates, and the file is
            deleted after reading.
          </Text>
        </Card>

        <SectionLabel>File</SectionLabel>
        <View style={styles.row}>
          <Chip label="PDF" selected={kind === 'pdf'} onPress={() => setKind('pdf')} />
          <Chip label="Photo" selected={kind === 'photo'} onPress={() => setKind('photo')} />
        </View>
        <Input label="File name" value={fileName} onChangeText={setFileName} />
        <Text variant="caption" color="muted">
          Up to {RESUME_UPLOAD_LIMITS.maxBytes / MB} MB and {RESUME_UPLOAD_LIMITS.maxPages} pages.
        </Text>
        <Input
          label="Resume text (optional, for trying the reader)"
          value={text}
          onChangeText={setText}
          multiline
          placeholder={'Major: Economics\nClass: 2027\nSkills: Excel, Spanish'}
        />

        {error && <ErrorText>{error}</ErrorText>}
        <Button
          label="Upload and read"
          icon="plus"
          disabled={busy || !fileName.trim()}
          onPress={upload}
        />
        <Button
          label="Fill it in myself instead"
          variant="secondary"
          onPress={() => router.replace('/card/editor')}
        />
      </Gutter>
    </Screen>
  );
}

const styles = StyleSheet.create({
  note: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    backgroundColor: colors.brandTint,
    borderColor: colors.brandTint,
  },
  grow: { flex: 1 },
  row: { flexDirection: 'row', gap: spacing.sm },
});
