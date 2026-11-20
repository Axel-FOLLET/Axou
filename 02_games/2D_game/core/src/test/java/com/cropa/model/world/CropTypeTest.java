package com.cropa.model.world;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

class CropTypeTest {

  @Test
  void hasFourCropTypes() {
    assertEquals(4, CropType.values().length);
  }

  @Test
  void valueOfFindsCarrot() {
    assertEquals(CropType.CARROT, CropType.valueOf("CARROT"));
  }
}