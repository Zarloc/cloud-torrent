package main

import (
	"log"

	"github.com/Zarloc/cloud-torrent/server"
	"github.com/jpillora/opts"
)

var VERSION = "dev" //set with ldflags

func main() {
	s := server.Server{
		Title:      "Cloud Torrent",
		Port:       9000,
		ConfigPath: "cloud-torrent.json",
	}

	o := opts.New(&s)
	o.Version(VERSION)
	o.PkgRepo()
	o.LineWidth = 96
	o.Parse()

	if err := s.Run(VERSION); err != nil {
		log.Fatal(err)
	}
}
