package util

import "time"

type Clock interface {
	Now() time.Time
}

type RealClock struct{}

func (c *RealClock) Now() time.Time {
	return time.Now()
}

type MonoClock struct {
	Time time.Time
}

func (c *MonoClock) Now() time.Time {
	now := c.Time
	c.Time = c.Time.Add(time.Duration(1) * time.Second)
	return now
}
