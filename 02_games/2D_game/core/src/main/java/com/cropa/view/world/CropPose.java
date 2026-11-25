package com.cropa.view.world;

import com.cropa.view.Bounds;
import com.cropa.view.Canvas;
import com.cropa.view.SpriteStyle;
import com.cropa.view.TextStyle;
import com.cropa.view.Tint;
import com.cropa.view.fx.Effects;
import com.cropa.view.fx.Particle;
import java.util.Objects;

// Each cell remembers only its previous occupant and the current visual transition.
final class CropPose {
  private enum Motion { STILL, GROW, HARVEST, EAT, CRUSH }

  // Durations in seconds; damaged crops hold their last pose before fading.
  private static final float GROW = .6f, PEAK = .4f, HOP = .45f;
  private static final float BITE = .36f, FLATTEN = .2f, HOLD = .4f, FADE = .2f;
  private static final float SEED_SCALE = .6f, PEAK_SCALE = 1.08f, HOP_HEIGHT = 10f;
  private static final float FLAT_WIDTH = 1.2f, FLAT_HEIGHT = .25f;
  // Centre of the money readout starting at (8, 312) on the HUD.
  private static final float MONEY_X = 32f, MONEY_Y = 312f;
  // One small burst per planting or harvest.
  private static final int BURST_COUNT = 8;
  private boolean observed;
  private Integer previousValue;
  private String previous, removed;
  private boolean previousMole;
  private Motion motion = Motion.STILL;
  private float started;

  void draw(Canvas canvas, Bounds cell, String key, boolean night, boolean mole,
            float clock, float phase, Effects effects, Integer value) {
    // The mole can leave the enemy list during the update that removes its meal.
    if (!Objects.equals(key, previous)) {
      started = clock;
      motion = Motion.STILL;
      if (isCrop(previous) && key == null) {
        removed = previous;
        motion = !night ? Motion.HARVEST : (mole || previousMole ? Motion.EAT : Motion.CRUSH);
        if (motion == Motion.HARVEST && effects != null) {
          float x = cell.x() + cell.width() / 2;
          float y = cell.y() + cell.height() / 2;
          effects.coinsTo(x, y, MONEY_X, MONEY_Y, coinCount(previous));
          effects.burst(Particle.LEAF, x, y, BURST_COUNT);
          if (previousValue != null) {
            effects.floatText("+" + previousValue, x, cell.y() + cell.height(), TextStyle.NORMAL);
          }
        }
      } else if (isNextStage(previous, key)) {
        motion = Motion.GROW;
      } else if (observed && previous == null && isCrop(key) && key.endsWith("_0") && effects != null) {
        effects.burst(Particle.DIRT, cell.x() + cell.width() / 2, cell.y() + cell.height() / 2, BURST_COUNT);
      }
      previous = key;
    }
    // The next frame may find an empty cell, so retain the value of this stage.
    observed = true;
    previousValue = value;
    previousMole = night && mole;
    float age = clock - started;
    if (motion == Motion.GROW && age < GROW) {
      float scale = age < PEAK ? lerp(SEED_SCALE, PEAK_SCALE, age / PEAK)
          : lerp(PEAK_SCALE, 1f, (age - PEAK) / (GROW - PEAK));
      canvas.drawSprite(key, cell, clock + phase, SpriteStyle.NORMAL.withScale(scale, scale));
    } else if (isCrop(key)) {
      canvas.drawAnimation(key, cell, clock + phase, Tint.NORMAL);
    } else if (motion == Motion.HARVEST && age < HOP) {
      float t = age / HOP;
      canvas.drawSprite(removed, cell, age, SpriteStyle.NORMAL.withAlpha(1f - t)
          .withOffset(0f, 4f * HOP_HEIGHT * t * (1f - t)));
    } else if (motion == Motion.EAT || motion == Motion.CRUSH) {
      drawDamage(canvas, cell, age);
    }
  }

  // The explicit pose clock lets the bite clip hold its last frame during the fade.
  private void drawDamage(Canvas canvas, Bounds cell, float age) {
    boolean bitten = motion == Motion.EAT;
    float fadeStart = (bitten ? BITE : FLATTEN) + HOLD;
    if (age >= fadeStart + FADE) {
      motion = Motion.STILL;
      return;
    }
    SpriteStyle style = SpriteStyle.NORMAL.withAlpha(1f - Math.max(0f, age - fadeStart) / FADE);
    if (!bitten) {
      float t = Math.min(1f, age / FLATTEN);
      style = style.withScale(lerp(1f, FLAT_WIDTH, t), lerp(1f, FLAT_HEIGHT, t));
    }
    canvas.drawSprite(bitten ? removed + "_eaten" : removed, cell, age, style);
  }

  // Only vegetables have growth stages and leave a harvest or damage pose.
  private static boolean isCrop(String key) {
    return key != null && (key.startsWith("carrot_") || key.startsWith("turnip_")
        || key.startsWith("garlic_") || key.startsWith("pumpkin_"));
  }

  private static boolean isNextStage(String old, String key) {
    if (!isCrop(old) || !isCrop(key)) return false;
    int stage = old.lastIndexOf('_') + 1;
    return key.length() == old.length() && key.regionMatches(0, old, 0, stage)
        && key.charAt(stage) > old.charAt(stage);
  }

  // Three coins for carrots, four for turnips and garlic, five for pumpkins.
  private static int coinCount(String key) {
    if (key.startsWith("pumpkin_")) return 5;
    return key.startsWith("carrot_") ? 3 : 4;
  }

  private static float lerp(float from, float to, float t) {
    return from + (to - from) * t;
  }
}
