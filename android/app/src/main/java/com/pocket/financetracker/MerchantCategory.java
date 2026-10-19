package com.pocket.financetracker;

import java.text.Normalizer;
import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;

/** Merchant-only rules: conflicting or unknown names are never guessed. */
public final class MerchantCategory {
    private static final String[][] RULES = {
        {"Eating Out", "restaurant|restoranas|restoranelis|gastrobaras|gastropub|pizzeria|picerija|pizza|cafe|caffe|coffee|kavine|kavines|baras|bistro|burger|mcdonalds|mcdonald s|kfc|hesburger|starbucks"},
        {"Food", "supermarket|grocery|groceries|bakery|kepykla|maxima|lidl|rimi|norfa|iki"},
        {"Car", "petrol|gas station|fuel|degaline|degalines|autoservisas|car wash|carwash|auto repair|tyres|tires|parking|parkavimas"},
        {"House", "ikea|senukai|depo|furniture|baldai|hardware store|home improvement"},
        {"Drinks", "liquor|wine shop|beer shop|bottle shop|vynoteka|alkoteka"},
        {"Bills", "electricity|utilities|water utility|internet bill|telia|tele2|ignitis|vilniaus vandenys"},
        {"Paysera", "paysera"},
    };

    public static String categorize(String merchant) {
        if (merchant == null) return "Uncategorized";
        String normalized = Normalizer.normalize(merchant, Normalizer.Form.NFD).replaceAll("\\p{M}+", "")
            .toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", " ").trim();
        Set<String> matches = new LinkedHashSet<>();
        for (String[] rule : RULES) {
            if (Pattern.compile("(?:^| )(?:" + rule[1] + ")(?: |$)").matcher(normalized).find()) matches.add(rule[0]);
        }
        return matches.size() == 1 ? matches.iterator().next() : "Uncategorized";
    }

    private MerchantCategory() { }
}
