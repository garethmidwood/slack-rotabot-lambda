# Rotabot for Slack

This bot allows you to setup and manage daily rotas.

Currently only a daily, weekday rota is supported.

### What commands are available?
* `/rota create [rotaname]` - creates a rota with the given name 
* `/rota delete [rotaname]` - removed
* `/rota add [rotaname] @user` - adds @user to the given rota
* `/rota remove [rotaname] @user` - removes @user from the given rota
* `/rota list [rotaname|optional]` - lists rotas. If rota name is provided then it lists the members of that rota
* `/rota [rotaname]` - shows who is currently active on the rota
