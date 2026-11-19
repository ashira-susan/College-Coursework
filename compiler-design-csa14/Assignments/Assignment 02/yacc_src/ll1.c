/* Table-driven predictive (LL(1)) parser with panic-mode error recovery.
 * Grammar:  E->TE'  E'->+TE'|eps  T->FT'  T'->*FT'|eps  F->(E)|id
 * Usage: ll1 "<tokens separated by spaces>" [-r]   (-r enables recovery)
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

enum { E, EP, T, TP, F, NNT };                    /* non-terminals     */
enum { ID, PLUS, STAR, LP, RP, END, NT_ };        /* terminals         */
#define TERMBASE 100                              /* terminal code base */

static const char *ntname[] = {"E","E'","T","T'","F"};
static const char *tname[]  = {"id","+","*","(",")","$"};

typedef struct { int lhs; int len; int rhs[3]; const char *text; } Prod;
/* rhs symbols: <TERMBASE = non-terminal index, >=TERMBASE = terminal */
static Prod P[] = {
  /*0*/ {E , 2, {T, EP, 0},                 "E  -> T E'"},
  /*1*/ {EP, 3, {TERMBASE+PLUS, T, EP},     "E' -> + T E'"},
  /*2*/ {EP, 0, {0,0,0},                    "E' -> epsilon"},
  /*3*/ {T , 2, {F, TP, 0},                 "T  -> F T'"},
  /*4*/ {TP, 3, {TERMBASE+STAR, F, TP},     "T' -> * F T'"},
  /*5*/ {TP, 0, {0,0,0},                    "T' -> epsilon"},
  /*6*/ {F , 3, {TERMBASE+LP, E, TERMBASE+RP}, "F  -> ( E )"},
  /*7*/ {F , 1, {TERMBASE+ID, 0, 0},        "F  -> id"}
};

static int M[NNT][NT_];                           /* parsing table     */
/* sync[X][a] = 1 when a is in FOLLOW(X): used for panic-mode recovery */
static int sync[NNT][NT_];

static void build(void) {
    for (int i = 0; i < NNT; i++) for (int j = 0; j < NT_; j++) M[i][j] = sync[i][j] = -1;
    M[E][ID]=0;  M[E][LP]=0;
    M[EP][PLUS]=1; M[EP][RP]=2; M[EP][END]=2;
    M[T][ID]=3;  M[T][LP]=3;
    M[TP][PLUS]=5; M[TP][STAR]=4; M[TP][RP]=5; M[TP][END]=5;
    M[F][ID]=7;  M[F][LP]=6;
    int fe[] = {RP, END};             /* FOLLOW(E) = FOLLOW(E') */
    int ft[] = {PLUS, RP, END};       /* FOLLOW(T) = FOLLOW(T') */
    int ff[] = {PLUS, STAR, RP, END}; /* FOLLOW(F)              */
    for (int k = 0; k < 2; k++) sync[E][fe[k]] = sync[EP][fe[k]] = 1;
    for (int k = 0; k < 3; k++) sync[T][ft[k]] = sync[TP][ft[k]] = 1;
    for (int k = 0; k < 4; k++) sync[F][ff[k]] = 1;
}

#define LINE "--------------------------------------------------------------------------"
static int toks[256], ntok = 0;

static int lex(const char *s) {
    char buf[512]; strncpy(buf, s, 511); buf[511] = 0;
    for (char *p = strtok(buf, " "); p; p = strtok(NULL, " ")) {
        int t = -1;
        for (int k = 0; k < 6; k++) if (!strcmp(p, tname[k])) t = k;
        if (t < 0) t = ID;                        /* any word = identifier */
        toks[ntok++] = t;
    }
    toks[ntok++] = END;
    return ntok;
}

static void show(int *stk, int sp, int ip, const char *action) {
    char l[128] = "", r[128] = "";
    for (int k = 0; k <= sp; k++) {
        strcat(l, stk[k] >= TERMBASE ? tname[stk[k]-TERMBASE] : ntname[stk[k]]);
        strcat(l, " ");
    }
    for (int k = ip; k < ntok; k++) { strcat(r, tname[toks[k]]); strcat(r, " "); }
    printf("%-26s %-22s %s\n", l, r, action);
}

int main(int argc, char **argv) {
    int recover = (argc > 2 && !strcmp(argv[2], "-r"));
    build();
    lex(argc > 1 ? argv[1] : "id + id * id");
    int stk[256], sp = 0, ip = 0, errors = 0;
    stk[0] = TERMBASE + END; stk[++sp] = E;       /* bottom marker, start */
    printf("%-26s %-22s %s\n", "STACK (top at right)", "INPUT", "ACTION");
    puts(LINE);
    while (sp >= 0) {
        int X = stk[sp], a = toks[ip];
        char msg[160];
        if (X >= TERMBASE) {                      /* terminal on top      */
            if (X - TERMBASE == a) {
                if (a == END) { show(stk, sp, ip, "accept"); break; }
                snprintf(msg, sizeof msg, "match %s", tname[a]); show(stk, sp, ip, msg);
                sp--; ip++;
            } else {
                errors++;
                snprintf(msg, sizeof msg, "ERROR: expected %s, found %s%s",
                         tname[X-TERMBASE], tname[a],
                         recover ? " -> pop (insert missing)" : "");
                show(stk, sp, ip, msg);
                if (!recover) break;
                sp--;
                if (sp < 0) break;
            }
        } else {
            int p = M[X][a];
            if (p >= 0) {
                show(stk, sp, ip, P[p].text);
                sp--;
                for (int k = P[p].len - 1; k >= 0; k--) stk[++sp] = P[p].rhs[k];
            } else {
                errors++;
                if (!recover) {
                    snprintf(msg, sizeof msg, "ERROR: no entry M[%s,%s]",
                             ntname[X], tname[a]);
                    show(stk, sp, ip, msg); break;
                }
                if (sync[X][a] == 1 && sp > 1) {          /* a in FOLLOW(X): pop X */
                    snprintf(msg, sizeof msg, "ERROR M[%s,%s]: sync -> pop %s",
                             ntname[X], tname[a], ntname[X]);
                    show(stk, sp, ip, msg); sp--;
                } else if (a == END) {
                    show(stk, sp, ip, "ERROR: unexpected end -> pop"); sp--;
                }
                else {                            /* skip the input token   */
                    snprintf(msg, sizeof msg, "ERROR M[%s,%s]: skip %s",
                             ntname[X], tname[a], tname[a]);
                    show(stk, sp, ip, msg); ip++;
                }
            }
        }
    }
    puts(LINE);
    if (errors == 0) printf("Result: input ACCEPTED, no errors.\n");
    else printf("Result: %d syntax error(s) detected%s.\n", errors,
                recover ? " and recovered from" : "; parsing stopped");
    return errors != 0;
}
