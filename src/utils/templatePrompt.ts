export interface TemplatePromptValues {
  applianceObject: string;
  titleOverlay: string;
  environment: string;
  lighting: string;
  colorMaterial: string;
}

export interface CompileTemplatePromptOptions {
  appendTitleWhenNoVariables?: boolean;
  replaceAllLegacyVariables?: boolean;
}

export function compileTemplatePrompt(
  basePrompt: string,
  values: TemplatePromptValues,
  options: CompileTemplatePromptOptions = {},
): string {
  let prompt = basePrompt;

  prompt = prompt.replace(/\{\{OBJECT\}\}/g, values.applianceObject);
  prompt = prompt.replace(/\{\{TEXT_ZONE\}\}/g, values.titleOverlay);
  prompt = prompt.replace(/\{\{ENVIRONMENT\}\}/g, values.environment);
  prompt = prompt.replace(/\{\{PLACE\}\}/g, values.environment);
  prompt = prompt.replace(/\{\{LIGHTING\}\}/g, values.lighting);
  prompt = prompt.replace(/\{\{MOOD\}\}/g, values.lighting);
  prompt = prompt.replace(/\{\{COLOR_FINISH\}\}/g, values.colorMaterial);

  if (options.replaceAllLegacyVariables) {
    prompt = prompt.replace(/\{\{input\}\}/g, values.titleOverlay);
    prompt = prompt.replace(/\{\{VARIABLE_NAME\}\}/g, values.titleOverlay);
  } else if (prompt.includes('{{input}}')) {
    prompt = prompt.replace(/\{\{input\}\}/g, values.titleOverlay);
  } else if (prompt.includes('{{VARIABLE_NAME}}')) {
    prompt = prompt.replace(/\{\{VARIABLE_NAME\}\}/g, values.titleOverlay);
  }

  if (options.appendTitleWhenNoVariables && !basePrompt.includes('{{') && values.titleOverlay) {
    prompt = `${prompt} Display Title: "${values.titleOverlay}"`;
  }

  return prompt;
}
