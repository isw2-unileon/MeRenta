// Package response defines common API response helpers.
package response

import "github.com/gin-gonic/gin"

// Response wraps a standard API response payload.
type Response struct {
	Success bool        `json:"success"`
	Message string      `json:"message,omitempty"`
	Data    interface{} `json:"data,omitempty"`
	Error   string      `json:"error,omitempty"`
}

// OK sends a successful JSON response with the provided data.
func OK(c *gin.Context, status int, data interface{}) {
	c.JSON(status, Response{Success: true, Data: data})
}

// Error sends an error JSON response and aborts the request.
func Error(c *gin.Context, status int, msg string) {
	c.AbortWithStatusJSON(status, Response{Success: false, Error: msg})
}
