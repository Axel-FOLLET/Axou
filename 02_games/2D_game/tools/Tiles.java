// Draws the four tile sheets of the map (assets/maps/assets/), pixel by pixel, from the grids below.
// The sheets replace third-party sheets that could not be published: same file names, sizes and tile positions,
// so map_v1.tmx did not change. Only the tiles used by the map are drawn; the other cells stay empty.
// Run from the game folder: java tools/Tiles.java assets/maps/assets
import java.awt.image.BufferedImage;
import java.nio.file.Files;
import java.nio.file.Path;
import javax.imageio.ImageIO;

public class Tiles {
    private static final int TILE = 16;

    // The legend shared by the four sheets: one character per pixel, colour as 0xAARRGGBB.
    private static int argb(char pixel) {
        return switch (pixel) {
            case '.' -> 0x00000000; // transparent
            case '~' -> 0x5022140E; // translucent cast shadow

            case 'g' -> 0xFF79BF56; // grass
            case 's' -> 0xFFB86F50; // soil
            case 'c' -> 0xFFA96147; // clod
            case 'e' -> 0xFFD99359; // dry edge
            case 'h' -> 0xFFE4A672; // edge highlight

            case 'k' -> 0xFF301E14; // brown outline
            case 'b' -> 0xFF623F2A; // wood in shadow
            case 'w' -> 0xFFA27044; // wood
            case 'l' -> 0xFFDAAB67; // lit wood
            case 'a' -> 0xFFE7BB77; // fresh cut of the stump

            case 'B' -> 0xFF934631; // terracotta in shadow
            case 't' -> 0xFFCC704D; // terracotta
            case 'T' -> 0xFFF2A170; // rim of the pot
            case 'v' -> 0xFF2B811F; // stem
            case 'V' -> 0xFF448F34; // leaf
            case 'L' -> 0xFF93CE42; // lit leaf
            case 'r' -> 0xFFA33853; // petal in shadow
            case 'p' -> 0xFFE05170; // pink petal
            case 'P' -> 0xFFFF96A0; // lit petal
            case 'o' -> 0xFFD57A2C; // inside of the bell flower
            case 'y' -> 0xFFF5AE38; // pollen and bell flower
            case 'Y' -> 0xFFFFDE77; // lit yellow
            default -> throw new IllegalArgumentException("Unknown pixel: " + pixel);
        };
    }

    private static final String[] EMPTY = {
        "................", "................", "................", "................",
        "................", "................", "................", "................",
        "................", "................", "................", "................",
        "................", "................", "................", "................"
    };

    private static final String[] GRASS = {
        "gggggggggggggggg", "gggggggggggggggg", "gggggggggggggggg", "gggggggggggggggg",
        "gggggggggggggggg", "gggggggggggggggg", "gggggggggggggggg", "gggggggggggggggg",
        "gggggggggggggggg", "gggggggggggggggg", "gggggggggggggggg", "gggggggggggggggg",
        "gggggggggggggggg", "gggggggggggggggg", "gggggggggggggggg", "gggggggggggggggg"
    };

    private static final String[][] SOIL = {
        { // 0: top-left corner
            "ggggggggggghhhgg", "gggggghheeeeeehh", "gggghheeeeesssee", "gggheeeessssssss",
            "ggheesssssssssss", "gheessssssssssss", "ghesssssssssssss", "gheessssssssssss",
            "ghesssssssssssss", "hessssssssssssss", "hessssscssssssss", "gessssssssssssss",
            "ghesssssssssssss", "ghesssssssssssss", "ghesssssssssssss", "ghesssssssssssss"
        },
        { // 1: top edge
            "ggggggghhhgggggg", "hhhehhheeehhhehh", "eeeeeeessseeeeee", "ssseesssssssssss",
            "ssssssssssssssss", "ssssssssssssssss", "ssssssssssssssss", "ssssssssssssssss",
            "ssssssssssssssss", "sssssssssssssscs", "ssssssssssssssss", "ssssssssssssssss",
            "ssssssssssssssss", "ssssssssssssssss", "ssssssssssssssss", "ssssssssssssssss"
        },
        { // 2: top-right corner
            "gggggghhhggggggg", "hhehhheeehhggggg", "eeeeeessseehhggg", "ssssessssseeeggg",
            "ssssssssssseehgg", "sssssssssssseehg", "sssssssssssssehg", "sssssssssssssehg",
            "ssssssscssssseeh", "ssssssssssssssee", "ssssssssssssssse", "sssssssssssssseg",
            "sssssssssssssehg", "sssssssssssssehg", "sssssssssssssehg", "sssssssssssssehg"
        },
        { // 3: left edge
            "ghesssssssssssss", "ghesssssssssssss", "geesssssssssssss", "hessssssssssssss",
            "hessssssssssssss", "ghesssssssssssss", "ghesssssssssssss", "ggeessssssssssss",
            "gghessssssssssss", "ghesssssssssssss", "ghesssssssssssss", "ghessscsssssssss",
            "geesssssssssssss", "ghesssssssssssss", "ghesssssssssssss", "ghesssssssssssss"
        },
        { // 4: centre
            "ssssssssssssssss", "ssssssssssssssss", "ssssssssssssssss", "ssssssssssssssss",
            "ssssssssssssssss", "ssssssssssccssss", "ssssssssssssssss", "ssssssssssssssss",
            "ssssssssssssssss", "ssssssssssssssss", "ssssssssssssssss", "ssssscssssssssss",
            "ssssssssssssssss", "ssssssssssssssss", "ssssssssssssssss", "ssssssssssssssss"
        },
        { // 5: right edge
            "sssssssssssssehg", "sssssssssssssehg", "sssssssssssssehg", "sssssssssssssseg",
            "ssssssssssssssee", "ssssssssssssssee", "ssssssssssssseeh", "sssssssssssssehg",
            "ssssssssssscsehg", "sssssssssssssehg", "sssssssssssssehg", "sssssssssssseehg",
            "ssssssssssssehgg", "sssssssssssseehg", "sssssssssssssehg", "sssssssssssssehg"
        },
        { // 6: bottom-left corner
            "ghesssssssssssss", "ghesssssssssssss", "ghesssssssssssss", "geesssssssssssss",
            "hessssssssssssss", "hessssssssssssss", "ghesssssssssssss", "ghesssssssssssss",
            "gheesssssscsssss", "gghessssssssssss", "ggheesssssssssss", "gggheessssssssss",
            "ggggheeeesssssss", "gggggghheeeeeeee", "ggggggggghheeehh", "ggggggggggghhggg"
        },
        { // 7: bottom edge
            "ssssssssssssssss", "ssssssssssssssss", "ssssssssssssssss", "ssssssssssssssss",
            "ssssssssssssssss", "ssssssssssssssss", "ssssssssssssssss", "sssssscsssssssss",
            "ssssssssssssssss", "ssssssssssssssss", "ssssssssssssssss", "ssssssssssssssss",
            "sssssseeesssssss", "eeeeeeeheeeeeeee", "hheeehhgghhheehh", "ggghhggggggghhgg"
        },
        { // 8: bottom-right corner
            "sssssssssssssehg", "sssssssssssssehg", "sssssssssssssehg", "sssssssssssssseh",
            "ssssssssssssssee", "sssssssssssssseg", "ssssscsssssssegg", "sssssssssssssehg",
            "sssssssssssssehg", "sssssssssssseehg", "ssssssssssseehgg", "ssssssssssseehgg",
            "sssssssseeehhggg", "eeeeeeeeehhggggg", "hheehehhgggggggg", "ggghhggggggggggg"
        }
    };

    private static final String[] RAILS_RIGHT = {
        "......kkkkk.....", "......kllwk.....", "......klwwk.....", "......kbbbk.....",
        "......klwbkkkkkk", "......kwwbklllll", "......kwbbkwwwww", "......kwwbkkkkkk",
        "......klwbk.....", "......klwbk.....", "......kwwbkkkkkk", "......kwwbkwllll",
        "......kbwbkbwwww", "......kbwbkkkkkk", ".....~kwwbk~~~..", ".....~kkkkk~~..."
    };

    private static final String[] RAILS_LEFT = {
        "......kkkkk.....", "......kllwk.....", "......klwwk.....", "......kbbbk.....",
        "kkkkkkklwbk.....", "llllllkwwbk.....", "wwwwwwkwbbk.....", "kkkkkkkwwbk.....",
        "......klwbk.....", "......klwbk.....", "kkkkkkkwwbk.....", "lllllwkwwbk.....",
        "wwwwwbkbwbk.....", "kkkkkkkbwbk.....", ".....~kwwbk~~~..", ".....~kkkkk~~..."
    };

    private static final String[] POST = {
        "......kkkkk.....", "......kllwk.....", "......klwwk.....", "......kbbbk.....",
        "......klwbk.....", "......kwwbk.....", "......kwbbk.....", "......kwwbk.....",
        "......klwbk.....", "......klwbk.....", "......kwwbk.....", "......kwwbk.....",
        "......kbwbk.....", "......kbwbk.....", ".....~kwwbk~~~..", ".....~kkkkk~~..."
    };

    private static final String[] RAILS_BOTH = {
        "......kkkkk.....", "......kllwk.....", "......klwwk.....", "......kbbbk.....",
        "kkkkkkklwbkkkkkk", "llllllkwwbklllll", "wwwwwwkwbbkwwwww", "kkkkkkkwwbkkkkkk",
        "......klwbk.....", "......klwbk.....", "kkkkkkkwwbkkkkkk", "lllllwkwwbkwllll",
        "wwwwwbkbwbkbwwww", "kkkkkkkbwbkkkkkk", ".....~kwwbk~~~..", ".....~kkkkk~~..."
    };

    private static final String[] STUMP = {
        "................", "................", "................", ".....kkkkkk.....",
        "...kkllaaawkk...", "..kllwwwwwallk..", "..klwalllawawk..", "..klwlawwlwawk..",
        "..kwawwwwwaabk..", "...kwwaaawwbbk..", "...klwkkkwwbbk..", "...klwkwwkwbbk..",
        "..klwwkwwkwbwbk.", ".kwwwkbwwkbbwbk~", ".kkkklwbkkbbkkk~", "....kkk~~~kk~~.."
    };

    private static final String[] PINK_FLOWER = {
        ".......kk.......", ".....kkppk......", "....kPppPrkk....", "....kpPyyPPk....",
        ".....krYyprk....", "....kPprrpPk....", "....kprkkkrk....", "..kk.kkvk.kk....",
        "..kLvkkvkkLLk...", "...kLVkvkLVk....", "....kkkvVkk.....", "....kkkkkkkk....",
        "...ktTTTTttBk...", "....kTttttBk~~..", "....ktTttBBk~~~.", ".....kkkkkk~~~.."
    };

    private static final String[] BELL_FLOWERS = {
        "........kk......", ".......kvvkk....", "....kkkvk.kvk...", "...kvvkVk..kvk..",
        "..kYyk.kVk.kYyk.", "..kyYYk.kvkyYYk.", ".kYyyokkkvkyoYk.", "..kkokk.kvk.kkok",
        ".....kk.kvk...k.", "....kLVkkvkk....", ".....kLVvVLk....", "....kkkkkkkk....",
        "...ktTTTTttBk...", "....kTttttBk~~..", "....ktTttBBk~~~.", ".....kkkkkk~~~.."
    };

    private static BufferedImage render(int columns, int rows, String[][] cells) {
        if (cells.length != columns * rows) {
            throw new IllegalArgumentException("Wrong number of cells");
        }

        var sheet = new BufferedImage(columns * TILE, rows * TILE, BufferedImage.TYPE_INT_ARGB);
        for (int id = 0; id < cells.length; id++) {
            String[] grid = cells[id] == null ? EMPTY : cells[id];
            if (grid.length != TILE) {
                throw new IllegalArgumentException("Wrong height for tile " + id);
            }

            int originX = (id % columns) * TILE;
            int originY = (id / columns) * TILE;
            for (int y = 0; y < TILE; y++) {
                String row = grid[y];
                if (row.length() != TILE) {
                    throw new IllegalArgumentException("Wrong width: tile " + id + ", row " + y);
                }
                for (int x = 0; x < TILE; x++) {
                    sheet.setRGB(originX + x, originY + y, argb(row.charAt(x)));
                }
            }
        }
        return sheet;
    }

    private static void writePng(Path file, BufferedImage sheet) throws java.io.IOException {
        try (var output = Files.newOutputStream(file)) {
            if (!ImageIO.write(sheet, "png", output)) {
                throw new java.io.IOException("No PNG encoder for " + file);
            }
        }
    }

    public static void main(String[] args) throws java.io.IOException {
        if (args.length != 1 || args[0].isBlank()) {
            throw new IllegalArgumentException("Usage: java Tiles.java <outDir>");
        }

        String[][] grass = new String[12 * 4][];
        for (int id = 0; id < grass.length; id++) {
            grass[id] = GRASS;
        }

        String[][] fence = new String[3 * 5][];
        fence[0] = RAILS_RIGHT;
        fence[2] = RAILS_LEFT;
        fence[3] = POST;
        fence[5] = POST;
        fence[6] = RAILS_RIGHT;
        fence[7] = RAILS_BOTH;

        String[][] decor = new String[7 * 12][];
        decor[14] = STUMP;
        decor[72] = PINK_FLOWER;
        decor[80] = BELL_FLOWERS;

        BufferedImage grassSheet = render(12, 4, grass);
        BufferedImage soilSheet = render(3, 3, SOIL);
        BufferedImage fenceSheet = render(3, 5, fence);
        BufferedImage decorSheet = render(7, 12, decor);

        ImageIO.setUseCache(false);
        Path out = Files.createDirectories(Path.of(args[0]));
        writePng(out.resolve("tileset_grass_spring.png"), grassSheet);
        writePng(out.resolve("farmland_tile.png"), soilSheet);
        writePng(out.resolve("fences_copiar.png"), fenceSheet);
        writePng(out.resolve("outdoor_decor_free.png"), decorSheet);
    }
}
