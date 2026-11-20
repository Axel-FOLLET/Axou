package com.cropa.teavm;

// WebApplication: libGDX in the browser (gdx-teavm). CropaGame and Language: the game and the language it starts in.
// JSBody: a line of JavaScript called from Java. Window and Navigator: the address of the page and the language of the
// browser.
import com.cropa.CropaGame;
import com.cropa.text.Language;
import com.github.xpenatan.gdx.teavm.backends.web.WebApplication;
import com.github.xpenatan.gdx.teavm.backends.web.WebApplicationConfiguration;
import org.teavm.jso.JSBody;
import org.teavm.jso.browser.Navigator;
import org.teavm.jso.browser.Window;

/** Launches the web version of the game, turned into JavaScript by TeaVM. */
public class TeaVMLauncher {
    private static final String LANGUAGE_PARAMETER = "lang=";

    public static void main(String[] args) {
        WebApplicationConfiguration config = new WebApplicationConfiguration();
        // 0 x 0: the game takes the whole page; its FitViewport keeps the ratio of the world and adds bars.
        config.width = 0;
        config.height = 0;
        new WebApplication(new CropaGame(language()), config) {
            // "Quitter" (Quit) at the end of a game calls Gdx.app.exit(), which does nothing in a browser by default.
            @Override
            public void exit() {
                quit();
            }
        };
    }

    // The site opens the game with "?lang=fr" or "?lang=en", so that it matches the page of the site. Without it, the
    // game starts in the language of the browser. The button of the title screen still switches it.
    private static Language language() {
        String code = languageOf(Window.current().getLocation().getSearch());
        return Language.fromCode(code != null ? code : Navigator.getLanguage());
    }

    /**
     * Reads the language in the query of an address.
     *
     * @param search the query of the page, such as "?lang=en", or an empty text
     * @return the value of "lang", or {@code null} when the query has none
     */
    static String languageOf(String search) {
        if (search == null) {
            return null;
        }
        for (String pair : search.replace("?", "").split("&")) {
            if (pair.startsWith(LANGUAGE_PARAMETER)) {
                return pair.substring(LANGUAGE_PARAMETER.length());
            }
        }
        return null;
    }

    // In a card of the portfolio (an iframe), the game tells the page of the site, which closes the card. Opened alone,
    // the tab closes; a browser only allows it for a tab opened by a link or a script.
    @JSBody(script = "if (window.parent !== window) {"
        + " window.parent.postMessage('game-quit', window.location.origin);"
        + " } else { window.close(); }")
    private static native void quit();
}
