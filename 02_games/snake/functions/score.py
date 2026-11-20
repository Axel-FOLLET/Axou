#!/usr/bin/env python3

import datetime

from functions.constants import SCORE_PATH


def read_best_score():
    # Reads the best score from the file, returns 0 if it does not exist or is badly formatted.
    try:
        with open(SCORE_PATH) as score_file:
            return int(score_file.readline().split()[0])
    except (FileNotFoundError, ValueError, IndexError):
        return 0


def save_best_score(score):
    # Saves the score and today's date ("w" overwrites the existing file).
    today = datetime.date.today()
    with open(SCORE_PATH, "w") as score_file:
        score_file.write(str(score) + " " + str(today))


def update_best_score(score):
    # Saves the score if it beats the record, returns True if it is a new record.
    if score > read_best_score():
        save_best_score(score)
        return True
    return False
