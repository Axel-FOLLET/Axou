#include <stdio.h>

int main(void)
{
    const int AGE_MAJORITE = 18;

    int a = 5;
    int b = 3;
    int somme = a + b;
    printf("%d\n", somme);

    if (somme >= AGE_MAJORITE)
    {
        printf("Vous êtes majeur.\n");
    }
    else
    {
        printf("Vous êtes mineur.\n");
    }
    return 0;
}