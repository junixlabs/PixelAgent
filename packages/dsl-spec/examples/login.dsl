# Login form — 1440x900 light theme.
# Exercises: SCREEN, TOKEN, LAYER, TEXT, INPUT, BUTTON, STATE.

SCREEN 1440 900 theme:light

TOKEN primary #185FA5
TOKEN surface #ffffff
TOKEN radius 8

LAYER login-card 500 260 440 400 bg:$surface r:12
  TEXT brand 0 20 "Acme" size:20 weight:semibold align:center max-width:440
  INPUT email-input 32 80 376 44 type:email label:"Email"
  INPUT pwd-input 32 156 376 44 type:password label:"Password"
  BUTTON login-btn 32 224 376 48 "Sign in" variant:primary
END

STATE login-btn hover
  bg: #0C447C
END
