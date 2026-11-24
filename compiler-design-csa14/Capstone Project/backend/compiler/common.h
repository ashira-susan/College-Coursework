/* common.h - shared declarations for the MiniCC compiler (lexer + parser + code generator) */
#ifndef COMMON_H
#define COMMON_H

typedef enum { TY_INT = 0, TY_FLOAT = 1 } VarType;

/* Attribute carried by every expression: where its value lives (a variable,
 * a constant or a temporary like t3) and its type. */
typedef struct {
    char *place;
    int   type;
} Attr;

/* ---------- utilities ---------- */
char *xstrdup(const char *s);

/* ---------- token table (filled by the lexer) ---------- */
void add_token(const char *category, const char *name, const char *lexeme,
               int line, int col);

/* ---------- diagnostics (lexical / syntax / semantic) ---------- */
void report(const char *kind, const char *severity, int line, int col,
            const char *fmt, ...);
int  error_count(void);

/* ---------- symbol table ---------- */
int         declare_sym(const char *name, VarType type, int line);
int         lookup_sym(const char *name);
VarType     sym_type(int index);

/* ---------- intermediate code (quadruples / three-address code) ---------- */
char *new_temp(void);
int   new_label(void);
void  emit(const char *op, const char *a1, const char *a2, const char *res);
void  emit_label(int n);
void  emit_goto(int n);
void  emit_iffalse(const char *cond, int n);

/* ---------- output ---------- */
void print_json(void);
void print_text(void);

#endif
