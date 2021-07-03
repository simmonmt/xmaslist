package database

import (
	"database/sql/driver"
	"fmt"
	"time"
)

type asSeconds struct {
	*time.Time
}

func (p asSeconds) Scan(src interface{}) error {
	secs, ok := src.(int64)
	if !ok {
		return fmt.Errorf("src isn't int64")
	}

	*p.Time = time.Unix(secs, 0)
	return nil
}

type nullSeconds struct {
	Time  time.Time
	Valid bool
}

func (p *nullSeconds) Scan(src interface{}) error {
	if src == nil {
		p.Valid = false
		return nil
	}

	secs, ok := src.(int64)
	if !ok {
		return fmt.Errorf("src isn't int64")
	}

	p.Time, p.Valid = time.Unix(secs, 0), true
	return nil
}

func (p nullSeconds) Value() (driver.Value, error) {
	if !p.Valid {
		return nil, nil
	}
	return p.Time, nil
}
