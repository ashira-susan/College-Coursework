from greetings import hello, goodbye


def test_hello():
    assert hello("Susan") == "Hello, Susan!"


def test_goodbye():
    assert goodbye("Susan") == "Goodbye, Susan!"
