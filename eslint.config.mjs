import js from '@eslint/js';
import tseslint from 'typescript-eslint';

const SPACING_PROPS =
  '^(padding|margin|gap|rowGap|columnGap)(Top|Bottom|Left|Right|Horizontal|Vertical|Start|End|Block|Inline)?$';
const SHAPE_PROPS =
  '^(borderRadius|border(Top|Bottom)(Left|Right|Start|End)Radius|fontSize|lineHeight)$';
const HEX_ANYWHERE = '#([0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\\b';
const COLOR_FN = '\\b(rgba?|hsla?|hwb|oklch|oklab|lab|lch)\\(';
const RAW_LENGTH = '^\\s*-?\\d';

const hint = 'Use a token from @team-impact/ui-tokens.';

/** Design-token rules for app code: no hardcoded colours, no magic spacing or shape numbers. */
const noMagicValues = [
  'error',
  {
    selector: `Literal[value=/${HEX_ANYWHERE}/]`,
    message: `Hardcoded hex colour. ${hint}`,
  },
  {
    selector: `Literal[value=/${COLOR_FN}/]`,
    message: `Hardcoded colour function. ${hint}`,
  },
  {
    selector: `TemplateElement[value.raw=/${HEX_ANYWHERE}|${COLOR_FN}/]`,
    message: `Hardcoded colour. ${hint}`,
  },
  {
    selector: `Property[key.name=/${SPACING_PROPS}/][value.type='Literal'][value.raw!='0']`,
    message: `Magic spacing number. Use spacing.* from @team-impact/ui-tokens.`,
  },
  {
    selector: `Property[key.name=/${SPACING_PROPS}/][value.type='UnaryExpression']`,
    message: `Magic spacing number. Use spacing.* from @team-impact/ui-tokens.`,
  },
  {
    selector: `Property[key.name=/${SPACING_PROPS}/][value.value=/${RAW_LENGTH}/]`,
    message: `Magic spacing length. Use spacing.* from @team-impact/ui-tokens.`,
  },
  {
    selector: `Property[key.name=/${SHAPE_PROPS}/][value.type='Literal'][value.raw!='0']`,
    message: `Magic radius or type size. Use radius.* or typography.* from @team-impact/ui-tokens.`,
  },
];

export default tseslint.config(
  {
    ignores: ['**/node_modules/**', '**/dist/**', '**/.expo/**', '**/drizzle/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['apps/athlete/**/*.{ts,tsx}', 'apps/portal/src/**/*.{ts,tsx}'],
    rules: { 'no-restricted-syntax': noMagicValues },
  },
);
