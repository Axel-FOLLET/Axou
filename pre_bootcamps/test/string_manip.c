#include <stdio.h>
#include <string.h>

int main(void)
{
    char mot[] = "bonjour";
    printf("%d\n", strlen(mot));

    char source[] = "bonjour";
    char destination[20];
    strcpy(destination, source);
    printf("%s\n", destination);

    char mot1[20] = "bon";
    char mot2[] = "jour";
    strcat(mot1, mot2);
    printf("%s\n", mot1);

    if (strcmp(mot1, mot2) == 0)
    {
        printf("Les mots sont identiques\n");
    }
    else
    {
        printf("Les mots sont différents\n");
    }

    return 0;
}