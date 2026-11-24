const GRAMMAR = `program      → statement*
statement    → declaration
             | assignment
             | if_stmt
             | while_stmt
             | print_stmt
             | block
             | ';'
block        → '{' statement* '}'
declaration  → type declarator (',' declarator)* ';'
type         → 'int' | 'float'
declarator   → IDENTIFIER ('=' expr)?
assignment   → IDENTIFIER '=' expr ';'
if_stmt      → 'if' '(' expr ')' statement ('else' statement)?
while_stmt   → 'while' '(' expr ')' statement
print_stmt   → 'print' '(' expr ')' ';'
expr         → expr ('+' | '-' | '*' | '/' | '%') expr
             | expr ('<' | '>' | '<=' | '>=' | '==' | '!=') expr
             | expr ('&&' | '||') expr
             | ('-' | '!') expr
             | '(' expr ')'
             | INTEGER | FLOAT | IDENTIFIER`;

const TOKENS = [
  ['Keywords', 'int  float  if  else  while  print'],
  ['Identifier', 'letter or _ , then letters, digits or _'],
  ['Integer', '42   (digits)'],
  ['Float', '3.14   2.5e3   (digits . digits, optional exponent)'],
  ['Operators', '+  -  *  /  %  =  ==  !=  <  >  <=  >=  &&  ||  !'],
  ['Separators', '(  )  {  }  ;  ,'],
  ['Ignored', 'spaces, tabs, newlines, // line comments, /* block comments */'],
];

const PRECEDENCE = [
  ['1 (highest)', '! and unary -', 'right'],
  ['2', '*  /  %', 'left'],
  ['3', '+  -', 'left'],
  ['4', '<  >  <=  >=', 'left'],
  ['5', '==  !=', 'left'],
  ['6', '&&', 'left'],
  ['7 (lowest)', '||', 'left'],
];

export default function GrammarView() {
  return (
    <div className="pad stack">
      <section>
        <h3>Grammar</h3>
        <pre className="code-block">{GRAMMAR}</pre>
        <p className="muted">
          A dangling <code>else</code> belongs to the nearest <code>if</code>. Variables live in one global scope and
          must be declared before use.
        </p>
      </section>

      <section>
        <h3>Tokens</h3>
        <table className="table">
          <tbody>
            {TOKENS.map(([name, rule]) => (
              <tr key={name}>
                <th scope="row">{name}</th>
                <td className="mono">{rule}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h3>Operator precedence</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Level</th>
              <th>Operators</th>
              <th>Associativity</th>
            </tr>
          </thead>
          <tbody>
            {PRECEDENCE.map(([level, ops, assoc]) => (
              <tr key={level}>
                <td>{level}</td>
                <td className="mono">{ops}</td>
                <td>{assoc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
