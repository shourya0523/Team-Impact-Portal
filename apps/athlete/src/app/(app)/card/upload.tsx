import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { RESUME_UPLOAD_LIMITS } from '@team-impact/contracts';
import { colors, spacing } from '@team-impact/ui-tokens';
import { api } from '@/api';
import { pickResume, type PickedResume, type ResumeKind } from '@/components/resumeFile';
import { ErrorText, Gutter, Screen, SectionLabel } from '@/components/ui';
import { Badge, Button, Card, Icon, Input, Text } from '@/ui';

const MB = 1024 * 1024;

/**
 * "/card/upload": hand over a resume (PDF, or a photo of a printed one). The file is read on the
 * server and deleted straight after; nothing it suggests reaches the card until the athlete
 * checks it on the next screen. In development the reader can also be tried with pasted text.
 */
export default function UploadResume() {
  const [file, setFile] = useState<PickedResume | null>(null);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const choose = (kind: ResumeKind) => {
    setError(null);
    pickResume(kind).then(
      (picked) => picked && setFile(picked),
      (e: Error) => setError(e.message),
    );
  };

  const send = (body: Parameters<typeof api.uploadResume>[0]) => {
    setBusy(true);
    setError(null);
    api.uploadResume(body).then(
      () => router.replace('/card/review'),
      (e: Error) => {
        setBusy(false);
        setError(e.message);
      },
    );
  };

  return (
    <Screen eyebrow="Impact Card" title="Upload resume" back>
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
          <Button label="Choose PDF" variant="secondary" stretch onPress={() => choose('pdf')} />
          <Button
            label="Choose photo"
            variant="secondary"
            stretch
            onPress={() => choose('photo')}
          />
        </View>
        <Text variant="caption" color="muted">
          Up to {RESUME_UPLOAD_LIMITS.maxBytes / MB} MB and {RESUME_UPLOAD_LIMITS.maxPages} pages. A
          clear, flat photo reads best.
        </Text>
        {file && (
          <View style={styles.row}>
            <Badge label={file.fileName} />
            <Badge label={`${Math.max(1, Math.round(file.sizeBytes / 1024))} KB`} />
          </View>
        )}

        {error && <ErrorText>{error}</ErrorText>}
        <Button
          label={busy ? 'Reading…' : 'Upload and read'}
          icon="plus"
          disabled={busy || !file}
          onPress={() => file && send(file)}
        />
        <Button
          label="Fill it in myself instead"
          variant="secondary"
          onPress={() => router.replace('/card/editor')}
        />

        {__DEV__ && (
          <>
            <SectionLabel>Try the reader with text (development)</SectionLabel>
            <Input
              label="Resume text"
              value={text}
              onChangeText={setText}
              multiline
              placeholder={'Major: Economics\nClass: 2027\nSkills: Excel, Spanish'}
            />
            <Button
              label="Read pasted text"
              variant="secondary"
              disabled={busy || !text.trim()}
              onPress={() =>
                send({
                  fileName: 'pasted-resume.txt',
                  mimeType: 'application/pdf',
                  sizeBytes: text.length,
                  text,
                })
              }
            />
          </>
        )}
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
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
