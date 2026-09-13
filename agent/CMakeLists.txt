cmake_minimum_required(VERSION 3.16)

project(SentriXAgent VERSION 0.6.0 LANGUAGES C)

set(CMAKE_C_STANDARD 11)

add_definitions(-D_GNU_SOURCE)

if(NOT DEFINED SENTRIX_VERSION_STRING)
    set(SENTRIX_VERSION_STRING "v${PROJECT_VERSION}")
endif()

set(SOURCES
    src/main.c
    src/core/transport.c
    src/core/checks.c
    src/core/cJSON.c
    src/platform/linux/cpu.c
    src/platform/linux/memory.c
    src/platform/linux/system.c
)

add_executable(sentrix-agent ${SOURCES})

target_include_directories(sentrix-agent PRIVATE
    include
    src/core
)

target_compile_definitions(sentrix-agent PRIVATE
    SENTRIX_VERSION_STRING="${SENTRIX_VERSION_STRING}"
)

target_link_libraries(sentrix-agent m)

install(TARGETS sentrix-agent RUNTIME DESTINATION bin)

set(CPACK_GENERATOR "TGZ")
set(CPACK_PACKAGE_NAME "sentrix-agent")
set(CPACK_PACKAGE_VENDOR "SentriX")
set(CPACK_PACKAGE_VERSION "${PROJECT_VERSION}")
set(CPACK_PACKAGE_FILE_NAME "sentrix-agent-${PROJECT_VERSION}-linux-${CMAKE_SYSTEM_PROCESSOR}")

include(CPack)
