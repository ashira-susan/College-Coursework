/* Recursive Descent Parser for the expression grammar (left recursion removed)
 *   E  -> T E'
 *   E' -> + T E' | epsilon
 *   T  -> F T'
 *   T' -> * F T' | epsilon
 *   F  -> ( E ) | id
 */
#include <stdio.h>
#include <stdlib.h>
#include <ctype.h>
#include <string.h>

static const char *src;      /* input string                */
static int  pos = 0;         /* current position in input   */
static char look;            /* lookahead: 'i'=id, '$'=end  */
static int  depth = 0;       /* depth used for the trace    */

static void advance(void) {
    while (isspace((unsigned char)src[pos])) pos++;
    if (src[pos] == '\0') { look = '$'; return; }
    if (isalpha((unsigned char)src[pos])) {
        while (isalnum((unsigned char)src[pos])) pos++;
        look = 'i';
        return;
    }
    look = src[pos++];
}

static void trace(const char *s) {
    for (int k = 0; k < depth; k++) printf("  ");
    printf("%s\n", s);
}

static void fail(const char *expected) {
    printf("\nSyntax error at position %d: expected %s but found '%c'\n",
           pos, expected, look);
    exit(1);
}

static void E(void);  static void Ep(void);
static void T(void);  static void Tp(void);  static void F(void);

static void E(void)  { trace("E  -> T E'");   depth++; T(); Ep(); depth--; }
static void Ep(void) {
    if (look == '+') { trace("E' -> + T E'"); depth++; advance(); T(); Ep(); depth--; }
    else if (look == ')' || look == '$') trace("E' -> epsilon");
    else fail("'+', ')' or end of input");
}
static void T(void)  { trace("T  -> F T'");   depth++; F(); Tp(); depth--; }
static void Tp(void) {
    if (look == '*') { trace("T' -> * F T'"); depth++; advance(); F(); Tp(); depth--; }
    else if (look == '+' || look == ')' || look == '$') trace("T' -> epsilon");
    else fail("'*', '+', ')' or end of input");
}
static void F(void) {
    if (look == 'i')      { trace("F  -> id"); advance(); }
    else if (look == '(') { trace("F  -> ( E )"); depth++; advance(); E();
                            if (look == ')') advance(); else fail("')'"); depth--; }
    else fail("identifier or '('");
}

int main(int argc, char *argv[]) {
    src = (argc > 1) ? argv[1] : "a+b*c";
    printf("Input : %s\n\n", src);
    advance();
    E();
    if (look == '$') printf("\nResult: input ACCEPTED (valid sentence of the grammar)\n");
    else             fail("end of input");
    return 0;
}
