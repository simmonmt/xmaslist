package util

import (
	"github.com/simmonmt/xmaslist/backend/database"

	uipb "github.com/simmonmt/xmaslist/proto/user_info"
)

func UserInfoFromDatabaseUser(dbUser *database.User) *uipb.UserInfo {
	return &uipb.UserInfo{
		Id:       int32(dbUser.ID),
		Username: dbUser.Username,
		Fullname: dbUser.Fullname,
		IsAdmin:  dbUser.Admin,
	}
}
