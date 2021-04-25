package main

import (
	"fmt"

	"google.golang.org/grpc"
)

func main() {
	fmt.Println("Hello world")

	fmt.Println(grpc.Version)
}
