#include <stdio.h>

void my_putchar(char c)
{
    printf("%c", c);
}

int main(void)
{
    my_putchar('A');
    printf("\n");
    return 0;
}