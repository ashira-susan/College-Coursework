# CSA1406 Assignment 1 - secure lexical analyzer
CC     = gcc
TESTS  = t1_valid t2_invalid_tokens t3_unterminated_comment t4_security t5_edge_cases

all: lexer

lex.yy.c: lexer.l
	flex lexer.l

lexer: lex.yy.c
	$(CC) lex.yy.c -o lexer

test: lexer
	@for t in $(TESTS); do \
	  ./lexer tests/$$t.c > /tmp/$$t.out 2>&1; \
	  if diff -q /tmp/$$t.out expected/$$t.out.txt >/dev/null; then echo "PASS $$t"; else echo "FAIL $$t"; fi; \
	done

check:
	python3 tools/check_c.py lexer.l

clean:
	rm -f lex.yy.c lexer
