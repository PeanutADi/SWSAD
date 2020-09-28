curl -XPOST "http://localhost:8081/users/log" -d '{
    "username":"test1",
    "password":"15ds5ad"
}' -H 'Content-Type: application/json' -c cookies.txt