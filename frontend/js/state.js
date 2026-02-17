export const state = {
    excludedRecipes: new Set(),
    lastPlanData: null,
    bgIndex: 0,
    slideshowInterval: null,
    compactView: false,
    mobileDayIndex: 0,
    allRecipesCache: null,
    wizardStep: 1,
    wizardData: {
        category: "",
        name: "",
        ingredients: "",
        seasonality: "",
        source1: "",
        source2: "",
    },
    prefStep: 0,
    prefRecipes: {},
    prefSelected: [],
    shoppingChecked: new Set(
        JSON.parse(localStorage.getItem("quickchef-shopping-checked") || "[]")
    ),

    // Auth state
    authToken: null,
    currentUser: null,
};
