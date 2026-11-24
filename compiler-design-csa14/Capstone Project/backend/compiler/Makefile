# Builds the MiniCC compiler:  flex (LEX)  +  bison (YACC)  +  gcc
CC      = gcc
CFLAGS  = -Wall -O2
TARGET  = minicc

all: $(TARGET)

parser.tab.c parser.tab.h: parser.y
	bison -d -Wall parser.y

lex.yy.c: lexer.l parser.tab.h
	flex lexer.l

$(TARGET): parser.tab.c lex.yy.c common.c common.h
	$(CC) $(CFLAGS) -o $@ parser.tab.c lex.yy.c common.c

clean:
	rm -f $(TARGET) parser.tab.c parser.tab.h lex.yy.c

.PHONY: all clean
