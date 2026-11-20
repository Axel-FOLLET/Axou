package com.cropa.lwjgl3;

import com.badlogic.gdx.Graphics;
import com.badlogic.gdx.backends.lwjgl3.Lwjgl3Application;
import com.badlogic.gdx.backends.lwjgl3.Lwjgl3ApplicationConfiguration;
import com.cropa.CropaGame;
import com.cropa.text.Language;
import java.util.Locale;

/** Launches the desktop (LWJGL3) application. */
public class Lwjgl3Launcher {
    // The size of the game world, in world pixels (see GameScreen), and the room kept free on the screen.
    private static final int WORLD_WIDTH = 560;
    private static final int WORLD_HEIGHT = 320;
    private static final int SCREEN_MARGIN = 120;

    public static void main(String[] args) {
        if (StartupHelper.startNewJvmIfRequired()) return; // This handles macOS support and helps on Windows.
        createApplication();
    }

    // The game starts in the language of the computer: French on a French system, English otherwise. The button of the
    // title screen switches it.
    private static Lwjgl3Application createApplication() {
        Language language = Language.fromCode(Locale.getDefault().getLanguage());
        return new Lwjgl3Application(new CropaGame(language), getDefaultConfiguration());
    }

    private static Lwjgl3ApplicationConfiguration getDefaultConfiguration() {
        Lwjgl3ApplicationConfiguration configuration = new Lwjgl3ApplicationConfiguration();
        configuration.setTitle("Cropa");
        //// Vsync limits the frames per second to what your hardware can display, and helps eliminate
        //// screen tearing. This setting doesn't always work on Linux, so the line after is a safeguard.
        configuration.useVsync(true);
        //// Limits FPS to the refresh rate of the currently active monitor, plus 1 to try to match fractional
        //// refresh rates. The Vsync setting above should limit the actual FPS to match the monitor.
        configuration.setForegroundFPS(Lwjgl3ApplicationConfiguration.getDisplayMode().refreshRate + 1);
        //// If you remove the above line and set Vsync to false, you can get unlimited FPS, which can be
        //// useful for testing performance, but can also be very stressful to some hardware.
        //// You may also need to configure GPU drivers to fully disable Vsync; this can cause screen tearing.

        // The window is the largest whole multiple of the world that fits the screen: 3 times on a 1920 x 1080 screen.
        // A whole multiple keeps every pixel of the art the same size. The margin leaves room for the title bar and the taskbar.
        Graphics.DisplayMode display = Lwjgl3ApplicationConfiguration.getDisplayMode();
        int scale = Math.max(1, Math.min((display.width - SCREEN_MARGIN) / WORLD_WIDTH, (display.height - SCREEN_MARGIN) / WORLD_HEIGHT));
        configuration.setWindowedMode(WORLD_WIDTH * scale, WORLD_HEIGHT * scale);
        //// You can change these files; they are in lwjgl3/src/main/resources/ .
        //// They can also be loaded from the root of assets/ .
        configuration.setWindowIcon("libgdx128.png", "libgdx64.png", "libgdx32.png", "libgdx16.png");

        //// This could improve compatibility with Windows machines with buggy OpenGL drivers, Macs
        //// with Apple Silicon that have to emulate compatibility with OpenGL anyway, and more.
        //// This uses the dependency `com.badlogicgames.gdx:gdx-lwjgl3-angle` to function.
        //// You would need to add this line to lwjgl3/build.gradle , below the dependency on `gdx-backend-lwjgl3`:
        ////     implementation "com.badlogicgames.gdx:gdx-lwjgl3-angle:$gdxVersion"
        //// You can choose to add the following line and the mentioned dependency if you want; they
        //// are not intended for games that use GL30 (which is compatibility with OpenGL ES 3.0).
        //// Know that it might not work well in some cases.
//        configuration.setOpenGLEmulation(Lwjgl3ApplicationConfiguration.GLEmulation.ANGLE_GLES20, 0, 0);

        return configuration;
    }
}