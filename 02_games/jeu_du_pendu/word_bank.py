#!/usr/bin/env python3
import random

def choose_word():
    # opens the French word list and reads every word, one per line
    file_path = "simple_words.txt"
    with open(file_path) as words_file:
        words = words_file.readlines()
    if len(words) == 0:
        # safety if the file is empty, to avoid a crash when choosing at random
        print("Error: empty file")
        exit()
    return random.choice(words).strip()
