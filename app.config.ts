export default {
    expo: {
        name: "ADHD Quest",
        slug: "adhd-quest",
        scheme: "adhd-quest",
        version: "1.0.0",
        orientation: "portrait",
        icon: "./assets/icon.png",
        userInterfaceStyle: "light",
        splash: {
            image: "./assets/splash-icon.png",
            resizeMode: "contain",
            backgroundColor: "#ffffff",
        },
        ios: {
            supportsTablet: true,
        },
        android: {
            package: "com.vali.adhdquest",
            adaptiveIcon: {
                backgroundColor: "#E6F4FE",
                foregroundImage: "./assets/android-icon-foreground.png",
                backgroundImage: "./assets/android-icon-background.png",
                monochromeImage: "./assets/android-icon-monochrome.png",
            },
            predictiveBackGestureEnabled: false,
        },
        web: {
            favicon: "./assets/favicon.png",
        },
        plugins: ["expo-router"],

        extra: {
            geminiApiKey: process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? "",
            eas: {
                projectId: "05ac6d8b-de49-4b68-b485-3980c96a61bc"
            }
        }
    }
};