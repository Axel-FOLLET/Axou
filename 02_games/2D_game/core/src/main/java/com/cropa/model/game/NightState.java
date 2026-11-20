package com.cropa.model.game;

// No import from model.enemy: the wave is reached through GameSession.getWaveSpawner, in the same package.

// The night: the wave comes in, and the player may not act until dawn.
// Pattern State: the night is one of the two phases of DayNightCycle; it starts the wave of its number, adds the
// enemies that appear, and ends early once the wave is out and no enemy is left.
/**
 * The night phase: the wave of enemies comes in, and the player may not buy, harvest or upgrade.
 */
public class NightState implements PhaseState {

  // -------------------- CONSTRUCTOR --------------------
  /**
   * Creates the night phase. It keeps nothing between two nights: the same one is used every night.
   */
  public NightState() {
  }

  // -------------------- PHASE STATE --------------------
  // Called once at the start of each night, by DayNightCycle, after the loops of GameSession.update.
  // The night N keeps the number of the day N (DayNightCycle.startNight does not change it): night 1 after day 1.
  // getWaveSpawner is package-private: NightState is in the same package as GameSession.
  // The neighbour leaves first: the night falls, even in the middle of a bubble. Before her day, it changes nothing.
  /**
   * Starts the night: the neighbour leaves, and the wave of this night begins, its first enemies come
   * after the start delay.
   *
   * @param session the game
   */
  @Override
  public void enter(GameSession session) {
    session.getNeighbour().leave();
    session.getWaveSpawner().startNight(session.getCycle().getNumber());
  }

  // Called at each frame by DayNightCycle.update, itself called by GameSession.update after its loops over the
  // enemies and the defenses: the list is never changed while it is walked (no ConcurrentModificationException).
  // session::addEnemy is a method reference: the same as enemy -> session.addEnemy(enemy).
  /**
   * Moves the night forward: the enemies of the wave whose time has come join the game.
   *
   * @param session the game
   * @param delta   the time since the previous update, in seconds
   */
  @Override
  public void update(GameSession session, float delta) {
    session.getWaveSpawner().update(delta).forEach(session::addEnemy);
  }

  // The night is over once the whole wave is out and every enemy of the game is dead or gone: the dawn comes at once,
  // without waiting for the timer. The check of the spawner comes first: during the first 5 s, before the first
  // enemy, the list is empty (or holds only the gone enemies of the night before), and "all dead or gone" would
  // already be true. The list keeps the enemies of the previous nights until GameSession removes them.
  /**
   * Tells whether the night is over before its timer: when the whole wave is out and no enemy is left.
   *
   * @param session the game
   * @return {@code true} if the wave is finished and every enemy is dead or has fled
   */
  @Override
  public boolean isOver(GameSession session) {
    return session.getWaveSpawner().isFinished()
        && session.getEnemies().stream().allMatch(enemy -> enemy.isDead() || enemy.hasFled());
  }

  // The rules: no buying, harvesting or upgrading at night.
  /**
   * Tells whether the player may act.
   *
   * @return always {@code false} at night
   */
  @Override
  public boolean canAct() {
    return false;
  }
}
