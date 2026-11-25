package com.cropa.text;

// The model: the kinds of crop and of defense, and the ways a game ends, each with its name.
// Java: List for the lines of a bubble or of the neighbour's talk.
import com.cropa.model.defense.DefenseType;
import com.cropa.model.game.GameResult;
import com.cropa.model.world.CropType;
import java.util.List;

// Every word the player reads, in French and in English, in one place: the view asks this object instead of writing
// its own words, so a language is chosen once, when a game starts. Each method gives the French text, then the
// English one, side by side: a translation is checked by reading one line.
// The texts only use characters of the game font (TextWidth): no typographic apostrophe, no narrow space.
/**
 * The texts of the game in one language.
 */
public final class Texts {

    //-------------------- CONSTANTS --------------------
    private static final Texts FRENCH = new Texts(Language.FRENCH);
    private static final Texts ENGLISH = new Texts(Language.ENGLISH);

    //-------------------- FIELDS --------------------
    private final Language language;

    //-------------------- CONSTRUCTOR --------------------
    // Two objects only, built above: Texts.of gives one of them.
    private Texts(Language language) {
        this.language = language;
    }

    /**
     * Returns the texts of a language.
     *
     * @param language the language to show
     * @return the texts in that language
     */
    public static Texts of(Language language) {
        return language == Language.FRENCH ? FRENCH : ENGLISH;
    }

    /**
     * Returns the language of these texts.
     *
     * @return French or English
     */
    public Language getLanguage() {
        return language;
    }

    //-------------------- NUMBERS --------------------
    // Group digits from the right, leaving the minus sign in front of the first group.
    // The game font uses a plain space for French thousands and a comma for English thousands.
    /**
     * Writes an amount with its thousands apart, as a player of this language reads them.
     *
     * @param amount the number
     * @return "3 450" in French, "3,450" in English
     */
    public String number(int amount) {
        StringBuilder grouped = new StringBuilder(Integer.toString(amount));
        int firstDigit = amount < 0 ? 1 : 0;
        char separator = language == Language.FRENCH ? ' ' : ',';
        for (int i = grouped.length() - 3; i > firstDigit; i -= 3) {
            grouped.insert(i, separator);
        }
        return grouped.toString();
    }

    //-------------------- TITLE SCREEN --------------------
    /**
     * Returns the full title of the game, cut in three lines.
     *
     * @return the three lines of the title
     */
    public List<String> titleLines() {
        return pick(
            List.of("Un vieil homme riche a volé l'urne de ma défunte femme,",
                "je compte la racheter en vendant mes récoltes",
                "mais des monstres attaquent ma plantation. 1"),
            List.of("A rich old man stole my late wife's urn,",
                "I plan to buy it back by selling my crops",
                "but monsters are attacking my plantation. 1"));
    }

    /** @return the invitation to click under the title */
    public String clickToPlay() {
        return pick("> Cliquer pour jouer <", "> Click to play <");
    }

    // The button of the title screen that changes the language: it names the other language, in that language.
    /** @return the label of the button that switches to the other language */
    public String otherLanguage() {
        return pick("English", "Français");
    }

    //-------------------- CINEMATICS --------------------
    /** @return the invitation to click under a scene */
    public String clickToContinue() {
        return pick("Cliquer pour continuer", "Click to continue");
    }

    /**
     * Returns the lines of the cinematic before the first day, one per image.
     *
     * @return the five lines
     */
    public List<String> introLines() {
        return pick(
            List.of("Le vieux Garry vivait seul dans sa ferme, avec son chat.",
                "Sur la cheminée trônait une urne : les cendres de sa défunte femme.",
                "Le riche et avare M. Chmunks trouva ce pot magnifique. Il le voulut.",
                "Une nuit, ses deux sbires volèrent l'urne.",
                "Prix de rachat : 10 000 pièces. Garry n'a que des graines... et une fourche."),
            List.of("Old Garry lived alone on his farm, with his cat.",
                "On the mantelpiece stood an urn: the ashes of his late wife.",
                "The rich and greedy Mr Chmunks found this pot gorgeous. He wanted it.",
                "One night, his two henchmen stole the urn.",
                "Ransom: 10,000 coins. Garry only has seeds... and a pitchfork."));
    }

    /**
     * Returns the lines of the cinematic after a victory, one per image.
     *
     * @return the three lines
     */
    public List<String> victoryLines() {
        return pick(
            List.of("Récolte après récolte, nuit après nuit, Garry réunit les 10 000 pièces.",
                "L'urne retrouva sa cheminée. Sa femme n'était jamais vraiment partie.",
                "Garry put enfin se reposer. Fin du tome 1."),
            List.of("Harvest after harvest, night after night, Garry gathered the 10,000 coins.",
                "The urn went back to its mantelpiece. His wife had never really left.",
                "Garry could finally rest. End of volume 1."));
    }

    //-------------------- HUD --------------------
    /**
     * Returns the first line of the HUD.
     *
     * @param money the player's money
     * @param farmHealth the farm's health
     * @param night true at night, false by day
     * @param number the number of the day or of the night
     * @param secondsLeft the seconds left in it
     * @return the line, for example "Argent : 100   PV ferme : 200   Jour : 1   Temps : 60 s"
     */
    public String status(int money, int farmHealth, boolean night, int number, int secondsLeft) {
        if (language == Language.FRENCH) {
            return "Argent : " + money + "   PV ferme : " + farmHealth + "   " + (night ? "Nuit" : "Jour") + " : "
                + number + "   Temps : " + secondsLeft + " s";
        }
        return "Money: " + money + "   Farm HP: " + farmHealth + "   " + (night ? "Night" : "Day") + ": "
            + number + "   Time: " + secondsLeft + " s";
    }

    /**
     * Returns the words of the urn gauge.
     *
     * @param money the player's money
     * @param urnPrice the price of the urn
     * @return for example "Urne : 3 450 / 10 000"
     */
    public String urnGauge(int money, int urnPrice) {
        return pick("Urne : ", "Urn: ") + number(money) + " / " + number(urnPrice);
    }

    /** @return the label of the button that starts the night */
    public String startNight() {
        return pick("Lancer la nuit", "Start the night");
    }

    /** @return the label of the same button the day before the last night */
    public String startLastNight() {
        return pick("Lancer la dernière nuit", "Start the last night");
    }

    /**
     * Returns the words of the sound button.
     *
     * @param muted {@code true} while the sound is cut
     * @return "Son : oui" while it plays, "Son : non" while it is cut
     */
    public String sound(boolean muted) {
        return muted ? pick("Son : non", "Sound off") : pick("Son : oui", "Sound on");
    }

    /**
     * Builds the heading shown at nightfall.
     *
     * @param number the night starting at one
     * @return the localized heading with its number
     */
    public String nightTitle(int number) {
        return pick("Nuit ", "Night ") + number;
    }

    /** @return the alert of the last night */
    public String lastNight() {
        return pick("Dernière nuit !", "Last night!");
    }

    /** @return the two lines of the warning of the last day to sell */
    public List<String> lastSaleWarning() {
        return pick(
            List.of("Vous ne pourrez plus rien vendre après.", "Seule la défense de votre ferme comptera."),
            List.of("You will not be able to sell anything after it.", "Only the defense of your farm will count."));
    }

    // A switch over the enum, with no default: a fourth GameResult does not compile until its words are written.
    /**
     * Returns the end of the game, shown in the HUD.
     *
     * @param result how the game ended
     * @return its words
     */
    public String ending(GameResult result) {
        return switch (result) {
            case VICTORY -> pick("Victoire !", "Victory!");
            case DEFEAT_FARM_DESTROYED -> pick("Défaite : la ferme est détruite", "Defeat: the farm is destroyed");
            case DEFEAT_URN_SOLD -> pick("Défaite : l'urne a été vendue", "Defeat: the urn was sold");
        };
    }

    //-------------------- SHOP --------------------
    /** @return the label of the button that opens the list of the crops */
    public String plant() {
        return pick("Planter", "Plant");
    }

    /** @return the label of the button that opens the list of the defenses */
    public String defenses() {
        return pick("Défenses", "Defenses");
    }

    // 20/11: the button left of the sound button has no room for the price; the gauge of the HUD shows it.
    /**
     * Returns the words of the urn button of the shop.
     *
     * @return "Acheter l'urne" or "Buy the urn"
     */
    public String urnOffer() {
        return pick("Acheter l'urne", "Buy the urn");
    }

    /**
     * Returns the name of a kind of defense.
     *
     * @param type the kind
     * @return its name
     */
    public String name(DefenseType type) {
        return switch (type) {
            case CATAPATATE -> pick("Catapatate", "Catapotato");
            case SCARECROW -> pick("Épouvantail", "Scarecrow");
            case BRAMBLE -> pick("Ronce", "Bramble");
        };
    }

    /**
     * Returns the name of a kind of crop.
     *
     * @param type the kind
     * @return its name
     */
    public String name(CropType type) {
        return switch (type) {
            case CARROT -> pick("Carotte", "Carrot");
            case TURNIP -> pick("Navet", "Turnip");
            case GARLIC -> pick("Ail", "Garlic");
            case PUMPKIN -> pick("Citrouille", "Pumpkin");
        };
    }

    /**
     * Returns the title of the panel of a defense: its name, its level and its durability.
     *
     * @param type the kind of defense
     * @param level its level, 1 to 3
     * @param durability its durability, in percent
     * @return for example "Épouvantail N1 100%"
     */
    public String defenseTitle(DefenseType type, int level, int durability) {
        return name(type) + " " + level(level) + " " + durability + "%";
    }

    // The same letter in the panel of the shop and in the labels of the defenses on the map.
    /**
     * Returns the level of a defense, in short.
     *
     * @param level its level, 1 to 3
     * @return "N1" in French ("niveau"), "L1" in English ("level")
     */
    public String level(int level) {
        return pick("N", "L") + level;
    }

    /** @return the words shown instead of the upgrade at level 3 */
    public String maxLevel() {
        return pick("Niveau max", "Max level");
    }

    /**
     * Returns the upgrade button of a defense, with its price.
     *
     * @param price the price of the upgrade
     * @return for example "Améliorer (100)"
     */
    public String upgrade(int price) {
        return upgradeWord() + " (" + price + ")";
    }

    /** @return the word of the upgrade, also used by the tutorial */
    public String upgradeWord() {
        return pick("Améliorer", "Upgrade");
    }

    /** @return the label of the button that removes a defense */
    public String remove() {
        return pick("Retirer", "Remove");
    }

    /**
     * Returns the button that sells a crop, with its price.
     *
     * @param price what the shop pays for it
     * @return for example "Vendre (40)"
     */
    public String sell(int price) {
        return pick("Vendre (", "Sell (") + price + ")";
    }

    /** @return the growth of a crop just planted */
    public String seed() {
        return pick("graine", "seed");
    }

    /** @return the growth of a crop that grows */
    public String growing() {
        return pick("en pousse", "growing");
    }

    /** @return the growth of a crop ready to harvest */
    public String ripe() {
        return pick("mûre", "ripe");
    }

    //-------------------- TUTORIAL --------------------
    // Cut by hand: 34 letters at most per line, 3 lines at most, in the frame of the neighbour's dialog.
    /**
     * Returns the five bubbles of the tutorial, each as its lines.
     *
     * @return the bubbles, in their order
     */
    public List<List<String>> tutorialBubbles() {
        return pick(
            List.of(
                List.of("Planter : clique sur une case", "vide du champ, puis sur une", "graine."),
                List.of("Défendre : clique sur un", "emplacement autour du champ,", "puis sur la catapatate."),
                List.of("Les chauves-souris n'aiment", "pas l'ail."),
                List.of("Les sorcières n'aiment pas", "le navet."),
                List.of("Améliorer : clique sur une", "défense, puis sur Améliorer.")),
            List.of(
                List.of("Plant: click an empty cell of", "the field, then a seed."),
                List.of("Defend: click a slot around", "the field, then the catapotato."),
                List.of("Bats do not like garlic."),
                List.of("Witches do not like turnips."),
                List.of("Upgrade: click a defense,", "then Upgrade.")));
    }

    /** @return the button that shows the next bubble of the tutorial */
    public String next() {
        return pick("Suivant", "Next");
    }

    /** @return the button of the last bubble of the tutorial */
    public String startPlaying() {
        return pick("Commencer à jouer", "Start playing");
    }

    //-------------------- NEIGHBOUR --------------------
    /** @return the button that shows the neighbour's next bubble */
    public String neighbourNext() {
        return pick("Passer à la suite", "Continue");
    }

    // Her talk comes from an interview made by the team. Two versions with the same start and the same end: the second
    // one at the first game, the first one at every "Rejouer" (GameConfig). The English one is close to the French,
    // without its swear word.
    /**
     * Returns what the neighbour says at the first game since the launch.
     *
     * @return her bubbles, in their order
     */
    public List<String> neighbourFirstGame() {
        return pick(
            List.of("Qu'est-ce qui se passe ici ? Comment vous allez ? Moi, ça va, je fais un petit tour.",
                "Je venais prendre des nouvelles. Comment va madame ? Oh, vous faites de la récolte ?",
                "Vous aimez mon brushing ? Ma coiffeuse kabyle m'a fait chier avec ses séries turques.",
                "Les acteurs, leurs morts... Je m'en fichais ! D'ailleurs, ma famille est turque !",
                "Je n'ai pas vu le match hier, mais 2-1, l'équipe est bidon. Je jouais à LoL.",
                "Ce jeu brise des amitiés ! Mon pote était trop dedans, alors j'ai coupé les ponts.",
                "Oulà, le soleil se couche ! Je dois voir mon cousin éloigné, il a une ferme pas loin."),
            List.of("What is going on here? How are you? I am fine, I am just taking a little walk.",
                "I came to see how you were. How is your wife? Oh, are you harvesting?",
                "Do you like my blow-dry? My Kabyle hairdresser drove me mad with her Turkish series.",
                "The actors, their deaths... I did not care! Actually, my family is Turkish!",
                "I did not see the match yesterday, but 2-1, the team is useless. I was playing LoL.",
                "That game breaks friendships! My mate was too into it, so I cut him off.",
                "Oh, the sun is setting! I must see my distant cousin, he has a farm nearby."));
    }

    /**
     * Returns what the neighbour says after a "Rejouer".
     *
     * @return her bubbles, in their order
     */
    public List<String> neighbourReplay() {
        return pick(
            List.of("Qu'est-ce qui se passe ici ? Comment vous allez ? Moi, ça va, je fais un petit tour.",
                "Je venais prendre des nouvelles. Comment va madame ? Oh, vous faites de la récolte ?",
                "J'ai de la famille dans l'agriculture. Je voyage de ville en ville pour voir les cultures.",
                "Pays-Bas, Italie, Grèce... Au bord de la mer, avec le soleil et l'eau, tout pousse !",
                "C'est le secret ! D'ailleurs, mon cousin éloigné habite très loin. Voilà.",
                "Au fait, vous aimez ma coupe ? La dernière était toute plate, à cause de l'huile.",
                "Oulà, le soleil se couche ! Je dois voir mon cousin éloigné, il a une ferme pas loin."),
            List.of("What is going on here? How are you? I am fine, I am just taking a little walk.",
                "I came to see how you were. How is your wife? Oh, are you harvesting?",
                "I have family in farming. I travel from town to town to see the crops.",
                "The Netherlands, Italy, Greece... By the sea, with the sun and the water, everything grows!",
                "That is the secret! By the way, my distant cousin lives very far away. There.",
                "By the way, do you like my haircut? The last one was all flat, because of the oil.",
                "Oh, the sun is setting! I must see my distant cousin, he has a farm nearby."));
    }

    //-------------------- END SCREEN --------------------
    /** @return the title of a victory */
    public String victoryTitle() {
        return pick("VICTOIRE !", "VICTORY!");
    }

    /** @return the title of a defeat */
    public String defeatTitle() {
        return pick("DÉFAITE", "DEFEAT");
    }

    /** @return the first line of a victory */
    public String urnBoughtBack() {
        return pick("Garry a racheté l'urne de sa femme.", "Garry bought back his wife's urn.");
    }

    /**
     * Returns the second line of a victory.
     *
     * @param day the day the urn was bought
     * @return for example "Rachetée au jour 6"
     */
    public String boughtOnDay(int day) {
        return pick("Rachetée au jour ", "Bought back on day ") + day;
    }

    /**
     * Returns the first line of a defeat by the farm: when it fell.
     *
     * @param night true if it fell at night
     * @param number the number of that night or day
     * @return for example "La ferme est tombée la nuit 5."
     */
    public String farmFell(boolean night, int number) {
        if (language == Language.FRENCH) {
            return "La ferme est tombée " + (night ? "la nuit " : "le jour ") + number + ".";
        }
        return "The farm fell on " + (night ? "night " : "day ") + number + ".";
    }

    /** @return the first line of a defeat by the urn */
    public String urnSold() {
        return pick("M. Chmunks a vendu l'urne. Trop tard.", "Mr Chmunks sold the urn. Too late.");
    }

    /** @return the button that starts a new game */
    public String replay() {
        return pick("Rejouer", "Play again");
    }

    /** @return the button that closes the game */
    public String quit() {
        return pick("Quitter", "Quit");
    }

    /** Pieces of the existing HUD sentence in their display order. */
    public List<String> statusParts(int money, int hp, boolean night, int number, int seconds) {
        return List.of(status(money, hp, night, number, seconds).split("   "));
    }

    /** Offer descriptions wrapped at word boundaries for the detail card. */
    public List<String> effect(CropType type) {
        return switch (type) {
            case CARROT -> pick(List.of("Pousse vite."),
                    List.of("Grows fast."));
            case TURNIP -> pick(List.of("Bloque la sorcière."),
                    List.of("Blocks the witch."));
            case GARLIC -> pick(List.of("Bloque la chauve-souris."),
                    List.of("Blocks the bat."));
            case PUMPKIN -> pick(List.of("Vaut le plus cher."),
                    List.of("Worth the most."));
        };
    }

    /** The effect of a defense offered by the market. */
    public List<String> effect(DefenseType type) {
        return switch (type) {
            case CATAPATATE -> pick(List.of("Portée de 2 cases (en", "ligne et en diagonale).", "Tire sur le premier", "ennemi à portée."),
                    List.of("Range of 2 tiles (in a", "straight line and", "diagonally). Fires at the", "first enemy in range."));
            case SCARECROW -> pick(List.of("Frappe au corps à corps", "les ennemis de sa case", "et des cases voisines", "en croix."),
                    List.of("Punches, in melee, the", "enemies on its tile and", "on the neighbouring tiles", "in a cross."));
            case BRAMBLE -> pick(List.of("Pique après 1 nuit de", "pousse. Blesse chaque", "ennemi qui la traverse."),
                    List.of("Stings after 1 night of", "growth. Hurts every", "enemy that crosses it."));
        };
    }

    public enum Action { PLANT, HARVEST, BUY, UPGRADE }

    /** The action on a field cell or defense slot. */
    public String title(Action action) {
        return switch (action) {
            case PLANT -> plant();
            case HARVEST -> pick("Récolter", "Harvest");
            case BUY -> pick("Acheter une défense", "Buy a defense");
            case UPGRADE -> upgradeWord();
        };
    }

    /** Mouse instructions in the language of the game. */
    public List<String> hint(Action action) {
        return switch (action) {
            case PLANT -> pick(List.of("Clic sur une case vide,", "puis choix de la graine :", "payée et plantée tout de", "suite."),
                    List.of("Click an empty tile, then", "choose the seed: it is", "paid for and planted at", "once."));
            case HARVEST -> pick(List.of("Clic sur une plante,", "puis Vendre : vendue",
                            "tout de suite à la valeur", "de son stade."),
                    List.of("Click a plant, then Sell:", "it is sold immediately,", "at the value of its stage."));
            case BUY -> pick(List.of("Clic dans la liste", "Défenses, puis sur", "un emplacement de",
                            "défense (ou sur une", "case du champ pour", "l'épouvantail et",
                            "la ronce) : payée et", "posée tout de suite."),
                    List.of("Click the defense in the", "shop, then click a", "defense slot (or a field",
                            "tile for the scarecrow", "and the bramble): it is", "paid for and placed", "at once."));
            case UPGRADE -> pick(List.of("Clic sur une défense,", "puis Améliorer."),
                    List.of("Click a defense, then", "Upgrade."));
        };
    }

    //-------------------- INTERNALS --------------------
    // The French value, or the English one: the two are written side by side by every method above.
    private <T> T pick(T french, T english) {
        return language == Language.FRENCH ? french : english;
    }
}
