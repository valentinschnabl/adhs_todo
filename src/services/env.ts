import Constants from 'expo-constants';

type ExpoExtra = {
    geminiApiKey?: string;
};

let didWarnQuotedGeminiKey = false;

function normalizeEnvValue(value: string | undefined): string | undefined {
    if (!value) {
        return undefined;
    }

    const hadWrappedQuotes = /^['"].*['"]$/.test(value.trim());
    const normalized = value.trim().replace(/^['"]|['"]$/g, '');
    if (hadWrappedQuotes && !didWarnQuotedGeminiKey) {
        didWarnQuotedGeminiKey = true;
        console.warn('[env] Gemini API key appears quoted; normalize your env/config value to avoid quotes.');
    }
    return normalized.length > 0 ? normalized : undefined;
}

export function getGeminiApiKey(): string | undefined {
    const extra = Constants.expoConfig?.extra as ExpoExtra | undefined;

    // Runtime config precedence:
    // 1) app config extra (expoConfig.extra)
    // 2) EXPO_PUBLIC_* build-time env
    // 3) GEMINI_API_KEY fallback
    return normalizeEnvValue(extra?.geminiApiKey)
        ?? normalizeEnvValue(process.env.EXPO_PUBLIC_GEMINI_API_KEY)
        ?? normalizeEnvValue(process.env.GEMINI_API_KEY);
}

// Intended for UI feature-availability checks.
export function hasGeminiApiKey(): boolean {
    return Boolean(getGeminiApiKey());
}