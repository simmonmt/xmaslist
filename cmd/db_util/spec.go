package main

import (
	"io"
	"os"

	yaml "gopkg.in/yaml.v2"
)

func readSpecFromFile(path string, spec interface{}) error {
	if path == "-" {
		return readSpec(os.Stdin, spec)
	}

	f, err := os.Open(path)
	if err != nil {
		return err
	}
	defer f.Close()

	return readSpec(f, spec)
}

func readSpec(r io.Reader, spec interface{}) error {
	d := yaml.NewDecoder(r)
	if err := d.Decode(spec); err != nil {
		return err
	}

	return nil
}
