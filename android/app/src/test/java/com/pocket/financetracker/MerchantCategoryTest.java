package com.pocket.financetracker;

import static org.junit.Assert.*;
import org.junit.Test;

public class MerchantCategoryTest {
    @Test public void vendorKeysNormalizeCaseAccentsAndSpacingWithoutMergingBranches() {
        assertEquals(MerchantCategory.key("  LOCAL Café+++ "), MerchantCategory.key("local cafe"));
        assertNotEquals(MerchantCategory.key("ABC Shop"), MerchantCategory.key("ABC Shop Vilnius"));
        assertNotEquals(MerchantCategory.key("Магазин"), MerchantCategory.key("Кафе"));
        assertEquals("", MerchantCategory.key("+++"));
    }
    @Test public void suppliedMerchantIsEatingOut() {
        assertEquals("Eating Out", MerchantCategory.categorize("GASTROBARAS +++"));
    }

    @Test public void clearMerchantNamesMatchExistingCategories() {
        String[][] examples = {{"LIDL 123", "Food"}, {"MAXIMA LT", "Food"}, {"Kavinė Vilnius", "Eating Out"},
            {"Coffee House", "Eating Out"}, {"Autoservisas Vilnius", "Car"}, {"Car Wash", "Car"},
            {"IKEA VILNIUS", "House"}, {"VYNOTEKA", "Drinks"}, {"IGNITIS", "Subscriptions"}, {"Paysera", "Paysera"}};
        for (String[] example : examples) assertEquals(example[0], example[1], MerchantCategory.categorize(example[0]));
    }

    @Test public void vagueConflictingAndSubstringNamesRemainUncategorized() {
        for (String name : new String[]{"UAB ABC", "SEB", "Amazon", "Circle K", "Maximally", "Coffee Grocery", "", "+++"}) {
            assertEquals(name, "Uncategorized", MerchantCategory.categorize(name));
        }
        assertEquals("Uncategorized", MerchantCategory.categorize(null));
    }
}
