package server

import (
	"errors"
	"fmt"
	"io/ioutil"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

const fileNumberLimit = 1000

type fsNode struct {
	Name     string
	Size     int64
	Modified time.Time
	Children []*fsNode
}

func (s *Server) listFiles() *fsNode {
	rootDir := s.state.Config.DownloadDirectory
	root := &fsNode{}
	if info, err := os.Stat(rootDir); err == nil {
		if err := list(rootDir, info, root, new(int)); err != nil {
			log.Printf("File listing failed: %s", err)
		}
	}
	return root
}

func (s *Server) serveFiles(w http.ResponseWriter, r *http.Request) {
	if strings.HasPrefix(r.URL.Path, "/download/") {
		url := strings.TrimPrefix(r.URL.Path, "/download/")
		//dldir is absolute
		dldir := s.state.Config.DownloadDirectory
		file := filepath.Join(dldir, url)
		//only allow fetches/deletes inside the dl dir
		if !strings.HasPrefix(file, dldir) || dldir == file {
			http.Error(w, "Nice try\n"+dldir+"\n"+file, http.StatusBadRequest)
			return
		}
		info, err := os.Stat(file)
		if err != nil {
			http.Error(w, "File stat error: "+err.Error(), http.StatusBadRequest)
			return
		}
		switch r.Method {
		case "GET":
			tfile, err := s.engine.GetTorrentByFileName(url)
			if err == nil {
				if p := s.engine.GetTorrentPercent(tfile); p < 100.0 {
					entry, err := NewFileReader(tfile)
					if err != nil {
						http.Error(w, "File open error: "+err.Error(), http.StatusInternalServerError)
						return
					}

					defer func() {
						if err := entry.Close(); err != nil {
							log.Printf("Error closing file reader: %s\n", err)
						}
					}()
					http.ServeContent(w, r, info.Name(), info.ModTime(), entry)
				} else {
					f, err := os.Open(file)
					if err != nil {
						http.Error(w, "File open error: "+err.Error(), http.StatusInternalServerError)
						return
					}
					http.ServeContent(w, r, info.Name(), info.ModTime(), f)
					f.Close()
				}
			} else {
				f, err := os.Open(file)
				if err != nil {
					http.Error(w, "File open error: "+err.Error(), http.StatusInternalServerError)
					return
				}
				http.ServeContent(w, r, info.Name(), info.ModTime(), f)
				f.Close()
			}
		case "DELETE":
			if err := os.RemoveAll(file); err != nil {
				http.Error(w, "Delete failed: "+err.Error(), http.StatusInternalServerError)
			}
		default:
			http.Error(w, "Not allowed", http.StatusMethodNotAllowed)
		}
		return
	}
	if strings.HasPrefix(r.URL.Path, "/info/") {
		url := strings.TrimPrefix(r.URL.Path, "/info/")
		dldir := s.state.Config.DownloadDirectory
		file := filepath.Join(dldir, url)
		if !strings.HasPrefix(file, dldir) || dldir == file {
			http.Error(w, "Nice try\n"+dldir+"\n"+file, http.StatusBadRequest)
			return
		}
		_, err := os.Stat(file)
		if err != nil {
			http.Error(w, "File stat error: "+err.Error(), http.StatusBadRequest)
			return
		}
		switch r.Method {
		case "GET":
			out, err := exec.Command("mediainfo", file).Output()
			if err != nil {
				http.Error(w, "Error: "+err.Error(), http.StatusInternalServerError)
			}
			w.WriteHeader(http.StatusOK)
			w.Write(out)
		default:
			http.Error(w, "Not allowed", http.StatusMethodNotAllowed)
		}
		return
	}
	s.static.ServeHTTP(w, r)
}

//custom directory walk

func list(path string, info os.FileInfo, node *fsNode, n *int) error {
	if (!info.IsDir() && !info.Mode().IsRegular()) || strings.HasPrefix(info.Name(), ".") {
		return errors.New("Non-regular file")
	}
	(*n)++
	if (*n) > fileNumberLimit {
		return errors.New("Over file limit") //limit number of files walked
	}
	node.Name = info.Name()
	node.Size = info.Size()
	node.Modified = info.ModTime()
	if !info.IsDir() {
		return nil
	}
	children, err := ioutil.ReadDir(path)
	if err != nil {
		return fmt.Errorf("Failed to list files")
	}
	node.Size = 0
	for _, i := range children {
		c := &fsNode{}
		p := filepath.Join(path, i.Name())
		if err := list(p, i, c, n); err != nil {
			continue
		}
		node.Size += c.Size
		node.Children = append(node.Children, c)
	}
	return nil
}
