import { describe, expect, it } from 'vitest';
import { compileTemplatePrompt, TemplatePromptValues } from './templatePrompt';

const values: TemplatePromptValues = {
  applianceObject: 'smart refrigerator',
  titleOverlay: 'Fresh Food',
  environment: 'modern kitchen',
  lighting: 'soft daylight',
  colorMaterial: 'brushed steel',
};

describe('compileTemplatePrompt', () => {
  it('replaces modular placeholders and their aliases globally', () => {
    const prompt = compileTemplatePrompt(
      '{{OBJECT}} and {{OBJECT}} in {{ENVIRONMENT}}/{{PLACE}} under {{LIGHTING}}/{{MOOD}}, {{COLOR_FINISH}}, {{TEXT_ZONE}}',
      values,
    );

    expect(prompt).toBe(
      'smart refrigerator and smart refrigerator in modern kitchen/modern kitchen under soft daylight/soft daylight, brushed steel, Fresh Food',
    );
  });

  it('preserves the Studio legacy else-if behavior', () => {
    expect(compileTemplatePrompt('{{input}} / {{VARIABLE_NAME}}', values)).toBe(
      'Fresh Food / {{VARIABLE_NAME}}',
    );
  });

  it('preserves the Builder behavior of replacing both legacy variables', () => {
    expect(
      compileTemplatePrompt('{{input}} / {{VARIABLE_NAME}}', values, {
        replaceAllLegacyVariables: true,
      }),
    ).toBe('Fresh Food / Fresh Food');
  });

  it('appends the title only for the Studio no-placeholder fallback', () => {
    expect(
      compileTemplatePrompt('A finished appliance.', values, {
        appendTitleWhenNoVariables: true,
      }),
    ).toBe('A finished appliance. Display Title: "Fresh Food"');
    expect(compileTemplatePrompt('A finished appliance.', values)).toBe('A finished appliance.');
  });

  it('does not append an empty fallback title', () => {
    expect(
      compileTemplatePrompt('A finished appliance.', { ...values, titleOverlay: '' }, {
        appendTitleWhenNoVariables: true,
      }),
    ).toBe('A finished appliance.');
  });
});
