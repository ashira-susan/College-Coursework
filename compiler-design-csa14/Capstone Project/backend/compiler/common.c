/* common.c - token table, diagnostics, symbol table, quadruple generator, output */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdarg.h>
#include "common.h"

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */
static void *xrealloc(void *p, size_t n) {
    void *q = realloc(p, n);
    if (!q) { fprintf(stderr, "out of memory\n"); exit(2); }
    return q;
}

char *xstrdup(const char *s) {
    size_t n = strlen(s) + 1;
    char *p = (char *)xrealloc(NULL, n);
    memcpy(p, s, n);
    return p;
}

/* ------------------------------------------------------------------ */
/* tokens                                                              */
/* ------------------------------------------------------------------ */
typedef struct { char *cat, *name, *lexeme; int line, col; } Token;
static Token *tokens; static int ntok, captok;

void add_token(const char *category, const char *name, const char *lexeme,
               int line, int col) {
    if (ntok == captok) {
        captok = captok ? captok * 2 : 64;
        tokens = (Token *)xrealloc(tokens, captok * sizeof(Token));
    }
    tokens[ntok].cat    = xstrdup(category);
    tokens[ntok].name   = xstrdup(name);
    tokens[ntok].lexeme = xstrdup(lexeme);
    tokens[ntok].line   = line;
    tokens[ntok].col    = col;
    ntok++;
}

/* ------------------------------------------------------------------ */
/* diagnostics                                                         */
/* ------------------------------------------------------------------ */
typedef struct { char *kind, *severity, *msg; int line, col; } Diag;
static Diag *diags; static int ndiag, capdiag;
static int nerrors, nwarnings;

void report(const char *kind, const char *severity, int line, int col,
            const char *fmt, ...) {
    char buf[512];
    va_list ap;
    va_start(ap, fmt);
    vsnprintf(buf, sizeof buf, fmt, ap);
    va_end(ap);

    if (ndiag == capdiag) {
        capdiag = capdiag ? capdiag * 2 : 16;
        diags = (Diag *)xrealloc(diags, capdiag * sizeof(Diag));
    }
    diags[ndiag].kind     = xstrdup(kind);
    diags[ndiag].severity = xstrdup(severity);
    diags[ndiag].msg      = xstrdup(buf);
    diags[ndiag].line     = line;
    diags[ndiag].col      = col;
    ndiag++;
    if (strcmp(severity, "error") == 0) nerrors++; else nwarnings++;
}

int error_count(void) { return nerrors; }

/* ------------------------------------------------------------------ */
/* symbol table (single global scope)                                  */
/* ------------------------------------------------------------------ */
typedef struct { char *name; VarType type; int line; } Sym;
static Sym *syms; static int nsym, capsym;

int lookup_sym(const char *name) {
    for (int i = 0; i < nsym; i++)
        if (strcmp(syms[i].name, name) == 0) return i;
    return -1;
}

/* returns 1 on success, 0 if the name was already declared */
int declare_sym(const char *name, VarType type, int line) {
    if (lookup_sym(name) >= 0) return 0;
    if (nsym == capsym) {
        capsym = capsym ? capsym * 2 : 16;
        syms = (Sym *)xrealloc(syms, capsym * sizeof(Sym));
    }
    syms[nsym].name = xstrdup(name);
    syms[nsym].type = type;
    syms[nsym].line = line;
    nsym++;
    return 1;
}

VarType sym_type(int index) { return syms[index].type; }

/* ------------------------------------------------------------------ */
/* quadruples                                                          */
/* ------------------------------------------------------------------ */
typedef struct { char *op, *a1, *a2, *res; } Quad;
static Quad *quads; static int nquad, capquad;
static int temp_counter, label_counter;

char *new_temp(void) {
    char buf[32];
    snprintf(buf, sizeof buf, "t%d", ++temp_counter);
    return xstrdup(buf);
}

int new_label(void) { return ++label_counter; }

void emit(const char *op, const char *a1, const char *a2, const char *res) {
    if (nquad == capquad) {
        capquad = capquad ? capquad * 2 : 32;
        quads = (Quad *)xrealloc(quads, capquad * sizeof(Quad));
    }
    quads[nquad].op  = xstrdup(op);
    quads[nquad].a1  = a1  ? xstrdup(a1)  : NULL;
    quads[nquad].a2  = a2  ? xstrdup(a2)  : NULL;
    quads[nquad].res = res ? xstrdup(res) : NULL;
    nquad++;
}

static void lab(char *buf, size_t n, int num) { snprintf(buf, n, "L%d", num); }

void emit_label(int n)   { char b[32]; lab(b, sizeof b, n); emit("label", NULL, NULL, b); }
void emit_goto(int n)    { char b[32]; lab(b, sizeof b, n); emit("goto", NULL, NULL, b); }
void emit_iffalse(const char *cond, int n) {
    char b[32]; lab(b, sizeof b, n); emit("ifFalse", cond, NULL, b);
}

/* Render one quadruple in readable three-address form. */
static void format_quad(const Quad *q, char *out, size_t n) {
    const char *op = q->op;
    if      (!strcmp(op, "label"))   snprintf(out, n, "%s:", q->res);
    else if (!strcmp(op, "goto"))    snprintf(out, n, "goto %s", q->res);
    else if (!strcmp(op, "ifFalse")) snprintf(out, n, "ifFalse %s goto %s", q->a1, q->res);
    else if (!strcmp(op, "print"))   snprintf(out, n, "print %s", q->a1);
    else if (!strcmp(op, "="))       snprintf(out, n, "%s = %s", q->res, q->a1);
    else if (!strcmp(op, "uminus"))  snprintf(out, n, "%s = - %s", q->res, q->a1);
    else if (!strcmp(op, "!"))       snprintf(out, n, "%s = ! %s", q->res, q->a1);
    else                             snprintf(out, n, "%s = %s %s %s", q->res, q->a1, op, q->a2);
}

/* ------------------------------------------------------------------ */
/* output                                                              */
/* ------------------------------------------------------------------ */
static void jstr(const char *s) {
    putchar('"');
    for (const unsigned char *p = (const unsigned char *)(s ? s : ""); *p; p++) {
        switch (*p) {
            case '"':  fputs("\\\"", stdout); break;
            case '\\': fputs("\\\\", stdout); break;
            case '\n': fputs("\\n", stdout);  break;
            case '\r': fputs("\\r", stdout);  break;
            case '\t': fputs("\\t", stdout);  break;
            default:
                if (*p < 0x20) printf("\\u%04x", *p);
                else putchar(*p);
        }
    }
    putchar('"');
}

static const char *tname(VarType t) { return t == TY_FLOAT ? "float" : "int"; }

void print_json(void) {
    int generated = (nerrors == 0);
    printf("{\n");
    printf("  \"success\": %s,\n", generated ? "true" : "false");
    printf("  \"errorCount\": %d,\n  \"warningCount\": %d,\n", nerrors, nwarnings);
    printf("  \"codeGenerated\": %s,\n", generated ? "true" : "false");
    printf("  \"stats\": {\"tokens\": %d, \"symbols\": %d, \"instructions\": %d, \"temporaries\": %d, \"labels\": %d},\n",
           ntok, nsym, generated ? nquad : 0, temp_counter, label_counter);

    printf("  \"tokens\": [");
    for (int i = 0; i < ntok; i++) {
        printf("%s\n    {\"line\": %d, \"col\": %d, \"category\": ", i ? "," : "", tokens[i].line, tokens[i].col);
        jstr(tokens[i].cat); printf(", \"name\": "); jstr(tokens[i].name);
        printf(", \"lexeme\": "); jstr(tokens[i].lexeme); printf("}");
    }
    printf("\n  ],\n");

    printf("  \"diagnostics\": [");
    for (int i = 0; i < ndiag; i++) {
        printf("%s\n    {\"kind\": ", i ? "," : "");
        jstr(diags[i].kind); printf(", \"severity\": "); jstr(diags[i].severity);
        printf(", \"line\": %d, \"col\": %d, \"message\": ", diags[i].line, diags[i].col);
        jstr(diags[i].msg); printf("}");
    }
    printf("\n  ],\n");

    printf("  \"symbols\": [");
    for (int i = 0; i < nsym; i++) {
        printf("%s\n    {\"name\": ", i ? "," : "");
        jstr(syms[i].name);
        printf(", \"type\": \"%s\", \"line\": %d}", tname(syms[i].type), syms[i].line);
    }
    printf("\n  ],\n");

    printf("  \"quads\": [");
    if (generated) {
        for (int i = 0; i < nquad; i++) {
            printf("%s\n    {\"index\": %d, \"op\": ", i ? "," : "", i);
            jstr(quads[i].op);
            printf(", \"arg1\": "); jstr(quads[i].a1);
            printf(", \"arg2\": "); jstr(quads[i].a2);
            printf(", \"result\": "); jstr(quads[i].res); printf("}");
        }
    }
    printf("\n  ],\n");

    printf("  \"tac\": [");
    if (generated) {
        char buf[512];
        for (int i = 0; i < nquad; i++) {
            format_quad(&quads[i], buf, sizeof buf);
            printf("%s\n    ", i ? "," : "");
            jstr(buf);
        }
    }
    printf("\n  ]\n}\n");
}

/* Human-readable report for terminal use:  ./minicc --text < program.mc */
void print_text(void) {
    printf("=== TOKENS (%d) ===\n", ntok);
    for (int i = 0; i < ntok; i++)
        printf("%3d:%-3d %-10s %-10s %s\n", tokens[i].line, tokens[i].col,
               tokens[i].cat, tokens[i].name, tokens[i].lexeme);

    printf("\n=== DIAGNOSTICS (%d errors, %d warnings) ===\n", nerrors, nwarnings);
    for (int i = 0; i < ndiag; i++)
        printf("[%s] %s at %d:%d - %s\n", diags[i].severity, diags[i].kind,
               diags[i].line, diags[i].col, diags[i].msg);

    printf("\n=== SYMBOL TABLE ===\n");
    for (int i = 0; i < nsym; i++)
        printf("%-12s %-6s (line %d)\n", syms[i].name, tname(syms[i].type), syms[i].line);

    printf("\n=== THREE-ADDRESS CODE ===\n");
    if (nerrors) { printf("(not generated: fix the errors above)\n"); return; }
    char buf[512];
    for (int i = 0; i < nquad; i++) {
        format_quad(&quads[i], buf, sizeof buf);
        printf("%s%s\n", strcmp(quads[i].op, "label") ? "    " : "", buf);
    }
}
